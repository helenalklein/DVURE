// Builds one Stripe PaymentIntent covering however many bookings the
// brand selected — "one big ticket," but only for the lines they chose
// to include. Every amount is recomputed here from the real booking
// rows (day_rate/days/agency_pct are immutable after creation as of
// 0020_bookings_insert_only.sql, so they're trustworthy inputs) — the
// client only ever sends which booking ids to include, never an amount.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const { bookingIds, campaignId } = await req.json();
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
      .select("id, brand_org_id, agency_org_id, day_rate, days, agency_pct, payment_status, model_profiles(full_name)")
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

    const lines = bookings.map((b) => {
      const gross = Math.round(Number(b.day_rate) * Number(b.days) * 100); // cents
      const payout = Math.round(gross * Number(b.agency_pct));
      return { bookingId: b.id, agencyOrgId: b.agency_org_id, grossCents: gross, payoutCents: payout };
    });
    const totalCents = lines.reduce((sum, l) => sum + l.grossCents, 0);
    if (totalCents <= 0) throw new Error("Invoice total must be greater than zero");

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: { booking_count: String(lines.length), campaign_id: campaignId ?? "" },
    });

    const { data: invoice, error: invoiceErr } = await supabaseAdmin
      .from("invoices")
      .insert({
        brand_org_id: membership.org_id,
        campaign_id: campaignId ?? null,
        total_amount: totalCents / 100,
        stripe_payment_intent_id: paymentIntent.id,
        created_by_profile_id: user.id,
      })
      .select("id")
      .single();
    if (invoiceErr || !invoice) throw new Error(`Failed to create invoice: ${invoiceErr?.message}`);

    const { error: lineErr } = await supabaseAdmin.from("invoice_line_items").insert(
      lines.map((l) => ({
        invoice_id: invoice.id,
        booking_id: l.bookingId,
        payee_org_id: l.agencyOrgId,
        gross_amount: l.grossCents / 100,
        payout_amount: l.payoutCents / 100,
      }))
    );
    if (lineErr) throw new Error(`Failed to create invoice line items: ${lineErr.message}`);

    return new Response(
      JSON.stringify({ invoiceId: invoice.id, clientSecret: paymentIntent.client_secret }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
