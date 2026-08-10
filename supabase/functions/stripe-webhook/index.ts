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
//
// invoice_payments rows for card only ever get written HERE, never at
// PaymentIntent-creation time (see 0054's header) — a card payment
// marked 'pending' up front has no way to leave that state if the
// charge is declined or the brand just abandons the form, since
// void_invoice_payment/confirm_invoice_payment both refuse card. Until
// Stripe confirms success, the real per-booking split just sits staged
// in invoice_card_payment_lines.
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
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;

        const { data: stagedLines } = await supabaseAdmin
          .from("invoice_card_payment_lines")
          .select("id, invoice_id, booking_id, gross_amount, payout_amount")
          .eq("stripe_payment_intent_id", pi.id);
        if (!stagedLines || stagedLines.length === 0) break; // not ours, or already handled (delivery retried)

        for (const line of stagedLines) {
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
        }

        // One invoice_payments row per invoice, not per booking — a
        // brand paying two bookings for the same agency in one charge
        // is one payment event against that agency's invoice, same as
        // how a manual payment is one event regardless of what it's for.
        const invoiceIds = [...new Set(stagedLines.map((l) => l.invoice_id))];
        const { data: invoicesData } = await supabaseAdmin
          .from("invoices")
          .select("id, campaign_id")
          .in("id", invoiceIds);
        const campaignByInvoice = new Map((invoicesData ?? []).map((i) => [i.id, i.campaign_id]));

        for (const invoiceId of invoiceIds) {
          const linesForInvoice = stagedLines.filter((l) => l.invoice_id === invoiceId);
          const grossTotal = linesForInvoice.reduce((sum, l) => sum + Number(l.gross_amount), 0);
          const payoutTotal = linesForInvoice.reduce((sum, l) => sum + Number(l.payout_amount), 0);
          const now = new Date().toISOString();

          await supabaseAdmin.from("invoice_payments").insert({
            invoice_id: invoiceId,
            amount: grossTotal,
            payment_method: "card",
            status: "accepted",
            pending_at: now,
            accepted_at: now,
            paid_at: now,
            stripe_payment_intent_id: pi.id,
          });
          // recompute_invoice_status (0053's trigger) derives
          // invoices.status from the row just inserted — no direct
          // write to invoices here.

          const { data: line } = await supabaseAdmin
            .from("invoice_line_items")
            .select("id, payee_org_id")
            .eq("invoice_id", invoiceId)
            .maybeSingle();

          if (line) {
            // Transfer this invoice's payout to the agency's connected
            // account — only if they've actually finished onboarding.
            // An independent model (payee_org_id null — no Connect
            // account concept exists for individuals in this pass) and
            // a not-yet-onboarded agency land in the same place: money
            // stays in DVURE's own balance, not lost, flagged for
            // follow-up rather than transferred.
            if (line.payee_org_id) {
              const { data: payee } = await supabaseAdmin
                .from("organizations")
                .select("stripe_connect_account_id, stripe_connect_payouts_enabled")
                .eq("id", line.payee_org_id)
                .single();

              if (payee?.stripe_connect_account_id && payee.stripe_connect_payouts_enabled && payoutTotal > 0) {
                try {
                  const transfer = await stripe.transfers.create({
                    amount: Math.round(payoutTotal * 100),
                    currency: "usd",
                    destination: payee.stripe_connect_account_id,
                    source_transaction: typeof pi.latest_charge === "string" ? pi.latest_charge : undefined,
                    metadata: { invoice_id: invoiceId },
                  });
                  await supabaseAdmin
                    .from("invoice_line_items")
                    .update({ stripe_transfer_id: transfer.id, transfer_status: "transferred" })
                    .eq("id", line.id);
                } catch (transferErr) {
                  console.error(`Transfer failed for invoice ${invoiceId}:`, transferErr);
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
            } else {
              await supabaseAdmin
                .from("invoice_line_items")
                .update({ transfer_status: "awaiting_payee_onboarding" })
                .eq("id", line.id);
            }
          }

          await supabaseAdmin.rpc("record_audit_event", {
            p_action: "invoice.card_payment_accepted",
            p_object_type: "invoice",
            p_object_id: invoiceId,
            p_campaign_id: campaignByInvoice.get(invoiceId) ?? null,
            p_new_value: { stripe_payment_intent_id: pi.id, gross_amount: grossTotal, source: "stripe_webhook" },
          });
        }

        await supabaseAdmin.from("invoice_card_payment_lines").delete().eq("stripe_payment_intent_id", pi.id);
        break;
      }

      // Nothing was ever persisted to invoice_payments for this PI (see
      // the file header), so there's nothing to mark failed and nothing
      // to void — just drop the staged reservation, freeing that
      // payee's remaining balance for a retry, and leave an audit trail
      // for follow-up.
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;

        const { data: stagedLines } = await supabaseAdmin
          .from("invoice_card_payment_lines")
          .select("invoice_id")
          .eq("stripe_payment_intent_id", pi.id);

        if (stagedLines && stagedLines.length > 0) {
          const invoiceIds = [...new Set(stagedLines.map((l) => l.invoice_id))];
          for (const invoiceId of invoiceIds) {
            await supabaseAdmin.rpc("record_audit_event", {
              p_action: "invoice.card_payment_failed",
              p_object_type: "invoice",
              p_object_id: invoiceId,
              p_new_value: { stripe_payment_intent_id: pi.id, source: "stripe_webhook" },
            });
          }
          await supabaseAdmin.from("invoice_card_payment_lines").delete().eq("stripe_payment_intent_id", pi.id);
        }
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
