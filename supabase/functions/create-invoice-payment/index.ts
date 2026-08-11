// Builds one Stripe PaymentIntent covering however many bookings the
// brand selected — "one big ticket," but only for the lines they chose
// to include. Every amount is recomputed here from the real booking
// rows (day_rate/days are immutable after creation as of
// 0020_bookings_insert_only.sql, so they're trustworthy inputs) — the
// client only ever sends which booking ids to include, never an amount.
// The actual charge is gross + a platform fee on top; the payee's
// invoice stays at gross — DVURE's cut is billed to the brand, never
// deducted from what a payee is owed. The fee rate depends on
// chargeMethod: ACH is meaningfully cheaper for DVURE to process than
// card (Stripe's own ACH fee is capped low; card's isn't), so it's
// priced lower to steer volume there. Because the rate is locked in at
// PaymentIntent-creation time, the brand picks ACH or card in DVURE's
// own UI first (RecordPaymentModal) — this never falls back to
// Stripe's automatic multi-method picker, which would let someone
// switch methods after the amount was already fixed for the other one.
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

// Mirrors src/lib/queries/bookings.ts's PLATFORM_FEE_PCT_BY_METHOD (no
// shared module between the Deno Edge Function runtime and the Vite
// app — keep both in sync by hand if these ever change). "Other"
// (check/wire/cash) uses the card rate — see
// create-noncircumvention-invoice's own copy of this constant.
const PLATFORM_FEE_PCT: Record<"ach" | "card", number> = { ach: 5.5, card: 6 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const { bookingIds, chargeMethod } = await req.json();
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

    // Same Stripe Customer create-setup-intent uses (organizations.
    // stripe_customer_id) — attaching it here is what lets a brand's
    // already-saved card actually show up as a selectable option in
    // this charge's PaymentElement instead of only ever offering a
    // blank "type a new card" form.
    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select("id, name, stripe_customer_id")
      .eq("id", membership.org_id)
      .single();
    if (orgErr || !org) throw new Error("Organization not found");

    let customerId = org.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({ name: org.name, email: user.email, metadata: { org_id: org.id } });
      customerId = customer.id;
      const { error: updateErr } = await supabaseAdmin
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", org.id);
      if (updateErr) throw new Error(`Failed to save Stripe customer id: ${updateErr.message}`);
    } else if (user.email) {
      // Backfill email on customers created before this field was added
      // — Stripe needs it to actually deliver a Stripe Invoice (see
      // create-noncircumvention-invoice), not just to save a card.
      await stripe.customers.update(customerId, { email: user.email }).catch((err) => console.error("Non-fatal: failed to backfill customer email:", err));
    }

    // bookings_select already scopes this to the caller's own org
    // relationship, so any id in bookingIds the caller doesn't actually
    // have access to just silently won't come back here — not a 403,
    // but it can't sneak into the invoice total either way.
    const { data: bookings, error: bookingsErr } = await supabaseUser
      .from("bookings")
      .select("id, campaign_id, brand_org_id, agency_org_id, model_id, day_rate, days")
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
      // The payee — agency or independent model — always receives their
      // full gross rate. DVURE's cut is never deducted from what's owed
      // to them; it's collected separately, on top, from the brand (see
      // feeCents below).
      const payoutCents = grossCents;
      const group = groups.get(key) ?? {
        agencyOrgId: isIndependent ? null : b.agency_org_id,
        modelId: isIndependent ? b.model_id : null,
        bookings: [],
      };
      group.bookings.push({ bookingId: b.id, grossCents, payoutCents });
      groups.set(key, group);
    }

    // Reserve every payee's invoice first — reserve_invoice_for_card_payment
    // is the sole source of truth for what's actually still owed (never
    // just the raw booking gross: a booking already partially paid by
    // check before this charge started owes less than its full value,
    // and the RPC is the only place that knows the real remaining
    // balance). Reserving before Stripe is ever called also means a
    // rejection here never leaves a live, unusable PaymentIntent behind.
    const reservations: { invoiceId: string; group: PayeeGroup; remainingCents: number }[] = [];
    for (const group of groups.values()) {
      const groupGrossCents = group.bookings.reduce((sum, b) => sum + b.grossCents, 0);
      const { data, error: reserveErr } = await supabaseUser.rpc("reserve_invoice_for_card_payment", {
        p_campaign_id: campaignId,
        p_invoice_total: groupGrossCents / 100,
        p_agency_org_id: group.agencyOrgId,
        p_model_id: group.modelId,
        p_crew_payee_id: null,
      });
      if (reserveErr || !data || data.length === 0) throw new Error(reserveErr?.message ?? "Could not reserve an invoice for this payment");
      const row = data[0] as { out_invoice_id: string; remaining_amount: number };
      reservations.push({ invoiceId: row.out_invoice_id, group, remainingCents: Math.round(Number(row.remaining_amount) * 100) });
    }

    // The fee is on top of what's owed to payees, not carved out of it
    // — invoices stay at gross, only the actual Stripe charge is
    // gross + fee. "Gross" here is each group's real remaining balance
    // (above), not the raw booking value, so a prior manual payment on
    // the same invoice is never charged again.
    const grossTotalCents = reservations.reduce((sum, r) => sum + r.remainingCents, 0);
    if (grossTotalCents <= 0) throw new Error("Invoice total must be greater than zero");
    const feePct = PLATFORM_FEE_PCT[chargeMethod as "ach" | "card"];
    const feeCents = Math.round(grossTotalCents * feePct / 100);
    const totalCents = grossTotalCents + feeCents;

    // customer is attached so this charge shows up under the org's
    // Stripe Customer — actually listing a saved card as selectable in
    // the PaymentElement needs a Customer Session too, tried and
    // reverted (see AddCardStep/CardPaymentStep history): the real
    // cuss_secret_... came back and the Element accepted it without
    // erroring, but the saved card still never appeared as an option —
    // needs more research before trying again.
    //
    // Exactly one payment_method_types entry, matching chargeMethod —
    // never both, since the fee is already locked in for whichever one
    // was chosen. This also means Stripe's PaymentElement has nothing
    // else to offer (no Klarna/Affirm/Cash App/Amazon Pay soup, no
    // switching methods mid-form after the amount was fixed).
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      customer: customerId,
      payment_method_types: [chargeMethod === "ach" ? "us_bank_account" : "card"],
      metadata: {
        booking_count: String(bookings.length),
        campaign_id: campaignId,
        charge_method: chargeMethod,
        platform_fee_pct: String(feePct),
        gross_amount: String(grossTotalCents / 100),
        platform_fee_amount: String(feeCents / 100),
      },
    });

    // Scaled to the group's real remaining balance, not each booking's
    // full original value — equal to the raw value whenever nothing's
    // been paid against this invoice yet (the common case), reduced
    // proportionally across a group's bookings when a prior manual
    // payment already covered part of it. Keeps invoice_payments.amount
    // (stripe-webhook sums these staged rows) matching what Stripe
    // actually charged, instead of double-counting the portion already
    // collected by another method.
    const stagingRows = reservations.flatMap(({ invoiceId, group, remainingCents }) => {
      const groupGrossCents = group.bookings.reduce((sum, b) => sum + b.grossCents, 0);
      const scale = remainingCents / groupGrossCents;
      return group.bookings.map((b) => ({
        stripe_payment_intent_id: paymentIntent.id,
        invoice_id: invoiceId,
        booking_id: b.bookingId,
        gross_amount: Math.round(b.grossCents * scale) / 100,
        payout_amount: Math.round(b.payoutCents * scale) / 100,
      }));
    });
    const { error: stagingErr } = await supabaseAdmin.from("invoice_card_payment_lines").insert(stagingRows);
    if (stagingErr) throw new Error(`Failed to stage payment: ${stagingErr.message}`);

    return new Response(
      JSON.stringify({
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
