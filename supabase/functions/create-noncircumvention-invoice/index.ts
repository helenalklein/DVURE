// Called right after a manual (check/wire/cash) payment gets confirmed
// — the money moved entirely outside Stripe, so there's no charge to
// collect DVURE's platform fee from directly. This bills it separately:
// a real Stripe Invoice, sent to the brand, for PLATFORM_FEE_PCT of the
// payment amount. Net 14, matching common invoicing convention — no
// account-lock enforcement wired up yet for a missed due date (that
// needs a scheduled check against Stripe's invoice status, not a
// one-off Edge Function call).
//
// Idempotent two ways: invoice_payments.stripe_noncircumvention_invoice_id
// is checked before doing anything, and 0058's unique index on that
// column is the hard backstop if this ever races or gets called twice.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const PLATFORM_FEE_PCT = 6;
const DAYS_UNTIL_DUE = 14;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const { paymentId } = await req.json();
    if (!paymentId || typeof paymentId !== "string") throw new Error("paymentId is required");

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

    const { data: payment, error: paymentErr } = await supabaseAdmin
      .from("invoice_payments")
      .select("id, invoice_id, amount, payment_method, status, stripe_noncircumvention_invoice_id")
      .eq("id", paymentId)
      .single();
    if (paymentErr || !payment) throw new Error("Payment not found");

    // Already billed — return the existing invoice instead of erroring,
    // so a retried call is a harmless no-op rather than a failure.
    if (payment.stripe_noncircumvention_invoice_id) {
      const existing = await stripe.invoices.retrieve(payment.stripe_noncircumvention_invoice_id);
      return new Response(JSON.stringify({ invoiceUrl: existing.hosted_invoice_url, invoiceId: existing.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }
    if (payment.status !== "accepted") throw new Error("Payment isn't confirmed yet");
    if (payment.payment_method === "card") throw new Error("Card payments already collect the fee in the charge itself");

    // RLS-scoped (user client, not admin) — the exact same visibility
    // boundary invoices_select already enforces (brand org or a payee
    // on the invoice). If the caller can't see this invoice, this
    // returns nothing and the request is rejected below, rather than
    // letting any signed-in user fire an invoice against an arbitrary
    // brand by guessing payment ids.
    const { data: invoice, error: invoiceErr } = await supabaseUser
      .from("invoices")
      .select("id, brand_org_id, campaign_id, campaigns(name)")
      .eq("id", payment.invoice_id)
      .single();
    if (invoiceErr || !invoice) throw new Error("You don't have access to this payment");

    const { data: brandOrg, error: brandErr } = await supabaseAdmin
      .from("organizations")
      .select("id, name, stripe_customer_id")
      .eq("id", invoice.brand_org_id)
      .single();
    if (brandErr || !brandOrg) throw new Error("Brand organization not found");

    let customerId = brandOrg.stripe_customer_id as string | null;
    let customerEmail: string | null = null;
    if (!customerId) {
      const { data: admin } = await supabaseAdmin
        .from("org_memberships")
        .select("profiles(email)")
        .eq("org_id", brandOrg.id)
        .eq("access_level", "administrator")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      customerEmail = (admin?.profiles as unknown as { email: string } | null)?.email ?? null;
      const customer = await stripe.customers.create({
        name: brandOrg.name,
        email: customerEmail ?? undefined,
        metadata: { org_id: brandOrg.id },
      });
      customerId = customer.id;
      const { error: updateCustomerErr } = await supabaseAdmin
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", brandOrg.id);
      if (updateCustomerErr) throw new Error(`Failed to save Stripe customer id: ${updateCustomerErr.message}`);
    }

    const campaignName = (invoice.campaigns as unknown as { name: string } | null)?.name ?? "your campaign";
    const feeAmount = Math.round(Number(payment.amount) * PLATFORM_FEE_PCT) / 100;

    await stripe.invoiceItems.create({
      customer: customerId,
      amount: Math.round(feeAmount * 100),
      currency: "usd",
      description: `DVURE platform fee (${PLATFORM_FEE_PCT}%) — ${campaignName}, paid outside DVURE`,
    });

    const draft = await stripe.invoices.create({
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: DAYS_UNTIL_DUE,
      auto_advance: true,
      metadata: { invoice_payment_id: payment.id, dvure_invoice_id: invoice.id },
    });

    const finalized = await stripe.invoices.finalizeInvoice(draft.id!);
    const sent = await stripe.invoices.sendInvoice(finalized.id!);

    const { error: updatePaymentErr } = await supabaseAdmin
      .from("invoice_payments")
      // noncircumvention_invoice_created_at anchors the 90-day
      // account-lock window (lock_overdue_accounts) — set here, not
      // derived from Stripe's own days_until_due, which is a separate,
      // softer payment-term reminder unrelated to DVURE's own lock policy.
      .update({ stripe_noncircumvention_invoice_id: sent.id, noncircumvention_invoice_created_at: new Date().toISOString() })
      .eq("id", payment.id);
    if (updatePaymentErr) throw new Error(`Invoice sent but failed to record it: ${updatePaymentErr.message}`);

    return new Response(JSON.stringify({ invoiceUrl: sent.hosted_invoice_url, invoiceId: sent.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
