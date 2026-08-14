// Builds one Stripe PaymentIntent covering however many bookings the
// brand selected — "one big ticket," but only for the lines they chose
// to include. Every amount is recomputed here from the real booking +
// allocation rows — the client only ever sends which booking ids to
// include and which payment method, never an amount.
//
// Two things changed from the original version of this function:
// (1) a booking can now owe more than one agency — see
// booking_agency_allocations (0038): a mother agency entitled 'always'
// plus the agency that actually booked, if different — so this
// produces one invoice_line_items row per allocation, not per booking.
// The webhook already loops over every line item transferring its own
// payout_amount to its own payee_org_id, so paying out multiple agencies
// on one booking needed no webhook changes.
// (2) the platform fee is now a real, explicit charge on top of gross,
// not an implicit "whatever's left after agency transfers" (see 0023's
// own header for how it used to work — the brand's card was charged
// gross only, and the fee was just DVURE never forwarding part of it).
// The brand picks ACH or card here, which fixes the fee rate for this
// charge; payees are unaffected either way, they still get exactly
// their allocated cut of gross.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

// Mirrors src/lib/queries/bookings.ts's PLATFORM_FEE_PCT_BY_METHOD — no
// shared module between the Deno Edge Function runtime and the Vite
// app, keep both in sync by hand if these ever change.
const PLATFORM_FEE_PCT: Record<"ach" | "card", number> = { ach: 5.5, card: 6 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const { bookingIds, campaignId, chargeMethod } = await req.json();
    if (!Array.isArray(bookingIds) || bookingIds.length === 0) throw new Error("bookingIds must be a non-empty array");
    if (chargeMethod !== "ach" && chargeMethod !== "card") throw new Error('chargeMethod must be "ach" or "card"');

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

    const { data: membership } = await supabaseUser
      .from("org_memberships")
      .select("org_id, access_level")
      .eq("profile_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership || membership.access_level !== "administrator") {
      throw new Error("Only an org administrator can authorize a payment");
    }

    // bookings_select already scopes this to the caller's own org
    // relationship, so any id in bookingIds the caller doesn't actually
    // have access to just silently won't come back here — not a 403,
    // but it can't sneak into the invoice total either way.
    const { data: bookings, error: bookingsErr } = await supabaseUser
      .from("bookings")
      .select("id, brand_org_id, day_rate, days, payment_status")
      .in("id", bookingIds);
    if (bookingsErr) throw new Error(bookingsErr.message);
    if (!bookings || bookings.length !== bookingIds.length) {
      throw new Error("One or more bookings weren't found or aren't yours to pay");
    }
    if (bookings.some((b) => b.brand_org_id !== membership.org_id)) {
      throw new Error("All selected bookings must belong to your own organization");
    }
    if (bookings.some((b) => b.payment_status === "paid")) {
      throw new Error("One or more selected bookings is already paid");
    }

    // service role here — allocations aren't necessarily visible under
    // the brand's own RLS (booking_agency_allocations_select scopes to
    // the agency side or the booking's own brand, which does cover this,
    // but using admin keeps this consistent with everything else in this
    // function reading admin-side for amount computation).
    const { data: allocations, error: allocErr } = await supabaseAdmin
      .from("booking_agency_allocations")
      .select("booking_id, agency_org_id, pct")
      .in("booking_id", bookingIds);
    if (allocErr) throw new Error(allocErr.message);

    const grossCentsByBooking = new Map(
      bookings.map((b) => [b.id, Math.round(Number(b.day_rate) * Number(b.days) * 100)])
    );
    const grossTotalCents = [...grossCentsByBooking.values()].reduce((sum, g) => sum + g, 0);
    if (grossTotalCents <= 0) throw new Error("Invoice total must be greater than zero");

    // The fee is added on top of what's owed to payees, never carved out
    // of it — every allocation's payout is exactly gross * pct,
    // regardless of chargeMethod. Only what the brand's card/bank is
    // actually charged changes.
    const feePct = PLATFORM_FEE_PCT[chargeMethod as "ach" | "card"];
    const feeCents = Math.round(grossTotalCents * feePct / 100);
    const totalCents = grossTotalCents + feeCents;

    // Exactly one payment_method_types entry, matching chargeMethod —
    // never both, since the fee is already locked in for whichever one
    // was chosen. This also means Stripe's PaymentElement has nothing
    // else to offer, so there's no way to switch methods mid-form after
    // the amount was fixed for the other one.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      payment_method_types: [chargeMethod === "ach" ? "us_bank_account" : "card"],
      metadata: {
        booking_count: String(bookings.length),
        campaign_id: campaignId ?? "",
        charge_method: chargeMethod,
        platform_fee_pct: String(feePct),
        gross_amount: String(grossTotalCents / 100),
        platform_fee_amount: String(feeCents / 100),
      },
    });

    const { data: invoice, error: invoiceErr } = await supabaseAdmin
      .from("invoices")
      .insert({
        brand_org_id: membership.org_id,
        campaign_id: campaignId ?? null,
        total_amount: totalCents / 100,
        stripe_payment_intent_id: paymentIntent.id,
        created_by_profile_id: user.id,
        charge_method: chargeMethod,
        platform_fee_amount: feeCents / 100,
      })
      .select("id")
      .single();
    if (invoiceErr || !invoice) throw new Error(`Failed to create invoice: ${invoiceErr?.message}`);

    const lineItems = (allocations ?? []).map((a) => {
      const grossCents = grossCentsByBooking.get(a.booking_id) ?? 0;
      return {
        invoice_id: invoice.id,
        booking_id: a.booking_id,
        payee_org_id: a.agency_org_id,
        gross_amount: grossCents / 100,
        payout_amount: Math.round(grossCents * Number(a.pct)) / 100,
      };
    });
    if (lineItems.length > 0) {
      const { error: lineErr } = await supabaseAdmin.from("invoice_line_items").insert(lineItems);
      if (lineErr) throw new Error(`Failed to create invoice line items: ${lineErr.message}`);
    }

    return new Response(
      JSON.stringify({
        invoiceId: invoice.id,
        clientSecret: paymentIntent.client_secret,
        grossAmount: grossTotalCents / 100,
        platformFeePct: feePct,
        platformFeeAmount: feeCents / 100,
        totalAmount: totalCents / 100,
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
