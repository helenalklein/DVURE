// "Authorize Payment" — real version. Replaces the client-manufactured
// status record_payment_attempt() was built to accept before Stripe
// existed. The charged amount is always computed here from the real
// booking row, never trusted from the client, so a tampered request
// can't check out for less than the actual day_rate * days.
//
// Scope note: this charges the FULL booking amount to DVURE's own
// Stripe balance — it does not yet split funds out to the agency/model
// at charge time (no `transfer_data` destination). Automatic payout
// splitting depends on a real decision about who gets paid how (the
// agency's own Connect account vs. the agency paying their model
// directly), not just wiring — see create-connect-account's own comment.
// This function is what actually collects real money; the split is the
// deliberately separate next step.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const { bookingId } = await req.json();
    if (!bookingId) throw new Error("bookingId is required");

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) throw new Error("Not signed in");

    // bookings_select (0002_rls.sql) already scopes this to the caller's
    // own org relationship to the booking — using the USER-scoped client
    // here (not admin) means a caller who isn't actually party to this
    // booking gets a real "not found" instead of us re-deriving that
    // check by hand.
    const { data: booking, error: bookingErr } = await supabaseUser
      .from("bookings")
      .select("id, campaign_id, brand_org_id, day_rate, days, payment_status, model_id, model_profiles(full_name)")
      .eq("id", bookingId)
      .single();
    if (bookingErr || !booking) throw new Error("Booking not found or you don't have access to it");

    const { data: membership } = await supabaseUser
      .from("org_memberships")
      .select("org_id, access_level")
      .eq("profile_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership || membership.org_id !== booking.brand_org_id || membership.access_level !== "administrator") {
      throw new Error("Only an administrator of the booking's own brand can authorize this payment");
    }

    if (booking.payment_status === "paid") throw new Error("This booking is already paid");

    const amountCents = Math.round(Number(booking.day_rate) * Number(booking.days) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) throw new Error("Invalid booking amount");

    const modelName = (booking as { model_profiles?: { full_name?: string } }).model_profiles?.full_name ?? "talent";
    const origin = req.headers.get("origin") ?? "https://dvure.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: { name: `Booking payment — ${modelName}` },
        },
        quantity: 1,
      }],
      metadata: { booking_id: booking.id, campaign_id: booking.campaign_id },
      success_url: `${origin}/brand/campaigns/${booking.campaign_id}?payment=success`,
      cancel_url: `${origin}/brand/campaigns/${booking.campaign_id}?payment=canceled`,
    });

    // Record the attempt as pending under the caller's own auth context
    // (not admin) — record_payment_attempt() (0018_audit_log.sql) already
    // re-checks the caller belongs to the booking's brand org itself, so
    // this stays consistent with every other write path in this schema:
    // never trust a service-role shortcut where an RPC's own check exists.
    const { error: rpcErr } = await supabaseUser.rpc("record_payment_attempt", {
      p_booking_id: booking.id,
      p_amount: amountCents / 100,
      p_status: "pending",
      p_stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    });
    if (rpcErr) throw new Error(`Failed to record payment attempt: ${rpcErr.message}`);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
