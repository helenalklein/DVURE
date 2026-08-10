// Builds one Stripe PaymentIntent covering however many bookings the
// brand selected — "one big ticket," but only for the lines they chose
// to include. Every amount is recomputed here from the real booking
// rows (day_rate/days/agency_pct are immutable after creation as of
// 0020_bookings_insert_only.sql, so they're trustworthy inputs) — the
// client only ever sends which booking ids to include, never an amount.
//
// Bookings are grouped by payee (agency org, or the model directly for
// an independent booking — bookings.agency_org_id has been nullable
// since 0049) and reserved one invoice at a time via
// reserve_invoice_for_card_payment (0054), which does the same
// find-or-create-invoice + remaining-balance validation
// record_invoice_payment uses for check/wire/cash. Nothing is written
// to invoice_payments here — only once the webhook sees the charge
// actually succeed (0054's header explains why: a card payment marked
// 'pending' up front has no way to leave that state if the brand
// abandons the form or the card is declined). The real per-booking
// split for this charge is staged in invoice_card_payment_lines,
// keyed by the PaymentIntent id, for the webhook to pick up.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const { bookingIds } = await req.json();
    if (!Array.isArray(bookingIds) || bookingIds.length === 0) throw new Error("bookingIds must be a non-empty array");

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
      .select("id, campaign_id, brand_org_id, agency_org_id, model_id, day_rate, days, agency_pct")
      .in("id", bookingIds);
    if (bookingsErr) throw new Error(bookingsErr.message);
    if (!bookings || bookings.length !== bookingIds.length) {
      throw new Error("One or more bookings weren't found or aren't yours to pay");
    }
    if (bookings.some((b) => b.brand_org_id !== membership.org_id)) {
      throw new Error("All selected bookings must belong to your own organization");
    }
    const campaignIds = new Set(bookings.map((b) => b.campaign_id));
    if (campaignIds.size !== 1) {
      throw new Error("All selected bookings must belong to the same campaign");
    }
    const campaignId = bookings[0].campaign_id as string;

    type PayeeGroup = {
      agencyOrgId: string | null;
      modelId: string | null;
      bookings: { bookingId: string; grossCents: number; payoutCents: number }[];
    };
    const groups = new Map<string, PayeeGroup>();
    for (const b of bookings) {
      const isIndependent = !b.agency_org_id;
      const key = isIndependent ? `model:${b.model_id}` : `agency:${b.agency_org_id}`;
      const grossCents = Math.round(Number(b.day_rate) * Number(b.days) * 100);
      // Only an agency's cut ever transfers out today (the model's own
      // share stays with the agency off-platform) — an independent
      // model has no agency to cut in, so the full gross is what they'd
      // eventually be owed once individual payouts exist; it's not
      // transferred yet either way (see the webhook's awaiting_payee_
      // onboarding fallback, since model_profiles has no Connect
      // account concept in this pass).
      const payoutCents = isIndependent ? grossCents : Math.round(grossCents * Number(b.agency_pct));
      const group = groups.get(key) ?? {
        agencyOrgId: isIndependent ? null : b.agency_org_id,
        modelId: isIndependent ? b.model_id : null,
        bookings: [],
      };
      group.bookings.push({ bookingId: b.id, grossCents, payoutCents });
      groups.set(key, group);
    }

    const totalCents = bookings.reduce((sum, b) => sum + Math.round(Number(b.day_rate) * Number(b.days) * 100), 0);
    if (totalCents <= 0) throw new Error("Invoice total must be greater than zero");

    // Reserve every payee's invoice — and validate the remaining
    // balance actually covers this charge — before Stripe is ever
    // called, so a rejection here never leaves a live, unusable
    // PaymentIntent behind.
    const reservations: { invoiceId: string; group: PayeeGroup }[] = [];
    for (const group of groups.values()) {
      const groupTotalCents = group.bookings.reduce((sum, b) => sum + b.grossCents, 0);
      const { data: invoiceId, error: reserveErr } = await supabaseUser.rpc("reserve_invoice_for_card_payment", {
        p_campaign_id: campaignId,
        p_invoice_total: groupTotalCents / 100,
        p_amount: groupTotalCents / 100,
        p_agency_org_id: group.agencyOrgId,
        p_model_id: group.modelId,
        p_crew_payee_id: null,
      });
      if (reserveErr || !invoiceId) throw new Error(reserveErr?.message ?? "Could not reserve an invoice for this payment");
      reservations.push({ invoiceId: invoiceId as string, group });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: { booking_count: String(bookings.length), campaign_id: campaignId },
    });

    const stagingRows = reservations.flatMap(({ invoiceId, group }) =>
      group.bookings.map((b) => ({
        stripe_payment_intent_id: paymentIntent.id,
        invoice_id: invoiceId,
        booking_id: b.bookingId,
        gross_amount: b.grossCents / 100,
        payout_amount: b.payoutCents / 100,
      }))
    );
    const { error: stagingErr } = await supabaseAdmin.from("invoice_card_payment_lines").insert(stagingRows);
    if (stagingErr) throw new Error(`Failed to stage payment: ${stagingErr.message}`);

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
