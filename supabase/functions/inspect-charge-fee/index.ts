// Diagnostic only, not wired into any UI — verifies DVURE's actual
// Stripe processing fee against what create-invoice-payment assumes
// (2.9%+30c card, 0.8% capped at $5 ACH) by inspecting a real charge's
// balance_transaction, the only place Stripe reports what it actually
// took, rather than trusting the publicly documented rate. Any signed-
// in user can call it — read-only against Stripe, no DB write, no
// sensitive data beyond what the org already sees on its own invoice.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) throw new Error("Not signed in");

    const { paymentIntentId } = await req.json();
    if (!paymentIntentId) throw new Error("paymentIntentId is required");

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });
    const charge = pi.latest_charge as Stripe.Charge | null;
    if (!charge) throw new Error("This PaymentIntent has no charge yet");
    const bt = charge.balance_transaction as Stripe.BalanceTransaction | null;
    if (!bt) throw new Error("No balance transaction yet — charge may still be settling");

    const grossCents = bt.amount;
    const feeCents = bt.fee;
    const feePct = Math.round((feeCents / grossCents) * 10000) / 100;

    return new Response(
      JSON.stringify({
        chargeMethod: pi.metadata?.charge_method ?? "card",
        assumedFeePct: pi.metadata?.platform_fee_pct ?? null,
        grossAmount: grossCents / 100,
        stripeFeeAmount: feeCents / 100,
        stripeFeePct: feePct,
        feeDetails: bt.fee_details,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
