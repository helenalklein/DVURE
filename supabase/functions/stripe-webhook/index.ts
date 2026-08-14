// The only place that gets to say "this payment actually succeeded."
// Stripe calls this directly (never the browser), so this is real
// server-to-server truth, not a client claiming an outcome.
//
// Signature verification is not optional: without it, anyone who finds
// this URL could POST a fake "payment succeeded" event and mark a real
// invoice as paid for free.
//
// Four separate Stripe event destinations all point at this same URL
// (Your account x Connected accounts, each split into snapshot/thin
// payload styles by Stripe's own dashboard) — each one has ITS OWN
// signing secret, not a shared one. STRIPE_WEBHOOK_SECRETS holds all of
// them, comma-separated; verification tries each in turn since there's
// no way to know in advance which destination sent a given request.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const webhookSecrets = (Deno.env.get("STRIPE_WEBHOOK_SECRETS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Our subscription_status enum ('trialing' | 'active' | 'past_due' |
// 'canceled') is deliberately narrower than Stripe's own status
// vocabulary — 'trialing' here means our own app-managed trial
// (organizations.trial_ends_at), not a Stripe-side trial, since
// create-subscription-checkout never creates one. "incomplete" (first
// payment not yet confirmed) returns null on purpose: the org should
// stay however it already was (almost always still 'trialing') until a
// real payment outcome exists, rather than jumping to a status that
// implies something happened.
function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): "active" | "past_due" | "canceled" | null {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return null;
  }
}

async function verifyAgainstAnySecret(body: string, signature: string): Promise<Stripe.Event> {
  let lastErr: unknown;
  for (const secret of webhookSecrets) {
    try {
      return await stripe.webhooks.constructEventAsync(body, signature, secret);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("No STRIPE_WEBHOOK_SECRETS configured");
}

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Missing Stripe-Signature header");
    if (webhookSecrets.length === 0) throw new Error("STRIPE_WEBHOOK_SECRETS is not set");
    event = await verifyAgainstAnySecret(body, signature);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      // The brand's card was actually charged for the invoice total.
      // This is the moment the platform fee is "collected" — not a
      // separate step, just every dollar this function doesn't transfer
      // out below.
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;

        const { data: invoice } = await supabaseAdmin
          .from("invoices")
          .select("id, campaign_id, status")
          .eq("stripe_payment_intent_id", pi.id)
          .maybeSingle();
        if (!invoice || invoice.status === "paid") break; // not ours, or already handled

        const { data: lineItems } = await supabaseAdmin
          .from("invoice_line_items")
          .select("id, booking_id, payee_org_id, gross_amount, payout_amount")
          .eq("invoice_id", invoice.id);

        for (const line of lineItems ?? []) {
          // Each booking still gets its own payments-table row (the
          // per-booking ledger predates invoices and other surfaces —
          // e.g. a campaign's own booking detail — still read from it).
          await supabaseAdmin.from("payments").insert({
            booking_id: line.booking_id,
            amount: line.gross_amount,
            status: "succeeded",
            stripe_payment_intent_id: pi.id,
          });
          await supabaseAdmin.from("bookings").update({ payment_status: "paid" }).eq("id", line.booking_id);

          // Transfer this line's payout to the agency's connected
          // account — only if they've actually finished onboarding.
          // Money that can't be transferred yet simply stays in DVURE's
          // own balance until the agency completes Connect onboarding;
          // it is NOT lost, and this is logged so it can be followed up.
          const { data: payee } = await supabaseAdmin
            .from("organizations")
            .select("stripe_connect_account_id, stripe_connect_payouts_enabled")
            .eq("id", line.payee_org_id)
            .single();

          if (payee?.stripe_connect_account_id && payee.stripe_connect_payouts_enabled && line.payout_amount > 0) {
            try {
              const transfer = await stripe.transfers.create({
                amount: Math.round(Number(line.payout_amount) * 100),
                currency: "usd",
                destination: payee.stripe_connect_account_id,
                source_transaction: typeof pi.latest_charge === "string" ? pi.latest_charge : undefined,
                metadata: { invoice_id: invoice.id, booking_id: line.booking_id },
              });
              await supabaseAdmin
                .from("invoice_line_items")
                .update({ stripe_transfer_id: transfer.id, transfer_status: "transferred" })
                .eq("id", line.id);
            } catch (transferErr) {
              console.error(`Transfer failed for line ${line.id}:`, transferErr);
              await supabaseAdmin
                .from("invoice_line_items")
                .update({ transfer_status: "failed" })
                .eq("id", line.id);
            }
          } else {
            await supabaseAdmin
              .from("invoice_line_items")
              .update({ transfer_status: "awaiting_payee_onboarding" })
              .eq("id", line.id);
          }
        }

        await supabaseAdmin
          .from("invoices")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", invoice.id);

        await supabaseAdmin.rpc("record_audit_event", {
          p_action: "invoice.paid",
          p_object_type: "invoice",
          p_object_id: invoice.id,
          p_campaign_id: invoice.campaign_id,
          p_new_value: { stripe_payment_intent_id: pi.id, line_count: (lineItems ?? []).length, source: "stripe_webhook" },
        });
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await supabaseAdmin
          .from("invoices")
          .update({ status: "failed" })
          .eq("stripe_payment_intent_id", pi.id);
        break;
      }

      // A subscription's status is the one source of truth for whether an
      // org's platform subscription is actually paid up — created fires
      // once at creation (still "incomplete" until the first invoice's
      // PaymentIntent confirms), updated fires on every later transition
      // (confirmed -> active, a renewal failing -> past_due, etc). Both
      // are handled identically: re-read the status and write it through.
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const status = mapStripeSubscriptionStatus(sub.status);
        if (!status) break; // "incomplete" — no payment confirmed yet, nothing to record
        await supabaseAdmin
          .from("organizations")
          .update({ subscription_status: status })
          .eq("stripe_subscription_id", sub.id);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await supabaseAdmin
          .from("organizations")
          .update({ subscription_status: "canceled" })
          .eq("stripe_subscription_id", sub.id);
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await supabaseAdmin
          .from("organizations")
          .update({
            stripe_connect_charges_enabled: !!account.charges_enabled,
            stripe_connect_payouts_enabled: !!account.payouts_enabled,
          })
          .eq("stripe_connect_account_id", account.id);
        break;
      }

      default:
        // Unhandled event types are expected and fine — Stripe sends a
        // broad default event set to every endpoint; we only act on the
        // ones above.
        break;
    }
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err);
    // Still 200 — Stripe retries on non-2xx, and retrying a handler that
    // failed on our own bug won't fix itself. Logged above for follow-up.
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
