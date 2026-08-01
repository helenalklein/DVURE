// The only place that gets to say "this payment actually succeeded."
// Stripe calls this directly (never the browser), so this is real
// server-to-server truth, not a client claiming an outcome — the entire
// reason record_payment_attempt() existed as a client-callable RPC
// before Stripe was wired in was a stand-in for exactly this.
//
// Signature verification is not optional: without it, anyone who finds
// this URL could POST a fake "payment succeeded" event and mark a real
// booking as paid for free. STRIPE_WEBHOOK_SECRET comes from this
// function's own endpoint in the Stripe dashboard (Developers ->
// Webhooks -> this endpoint -> Signing secret), not the account's
// general API secret key.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Missing Stripe-Signature header");
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id;
        if (!bookingId) break;

        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

        // Service-role write, deliberately bypassing record_payment_attempt()'s
        // own "caller belongs to this booking's brand org" check — there is
        // no authenticated user here, Stripe is the caller, and the booking
        // id in a signature-verified event is already trustworthy.
        const { data: booking } = await supabaseAdmin
          .from("bookings")
          .select("campaign_id")
          .eq("id", bookingId)
          .single();

        const { data: prevPayment } = await supabaseAdmin
          .from("payments")
          .select("id, status")
          .eq("booking_id", bookingId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (prevPayment) {
          await supabaseAdmin
            .from("payments")
            .update({ status: "succeeded", stripe_payment_intent_id: paymentIntentId, updated_at: new Date().toISOString() })
            .eq("id", prevPayment.id);
        } else {
          await supabaseAdmin.from("payments").insert({
            booking_id: bookingId,
            amount: (session.amount_total ?? 0) / 100,
            status: "succeeded",
            stripe_payment_intent_id: paymentIntentId,
          });
        }

        await supabaseAdmin.from("bookings").update({ payment_status: "paid" }).eq("id", bookingId);

        await supabaseAdmin.rpc("record_audit_event", {
          p_action: "payment.succeeded",
          p_object_type: "payment",
          p_object_id: prevPayment?.id ?? null,
          p_campaign_id: booking?.campaign_id ?? null,
          p_new_value: { booking_id: bookingId, stripe_payment_intent_id: paymentIntentId, source: "stripe_webhook" },
        });
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
