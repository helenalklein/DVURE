// Starts (or resumes) a real, billable DVURE platform subscription for
// the caller's own org — agencies only. Brands are free (DVURE
// monetizes brand activity through the transaction fee on bookings
// instead — see DEFAULT_PLATFORM_PCT in src/lib/queries/bookings.ts);
// there's simply no 'brand' entry in PLAN_BY_ORG_TYPE below, so a brand
// hitting this function gets a clean "no plan configured" error rather
// than a $0 Stripe subscription (a real recurring Stripe object for zero
// dollars would be pure friction with no benefit). Mirrors
// create-invoice-payment's shape (PaymentIntent -> clientSecret -> the
// client confirms with Stripe Elements) but for a recurring Subscription
// instead of a one-off invoice: payment_behavior "default_incomplete"
// creates the Subscription immediately in an "incomplete" state and
// expands its first invoice's PaymentIntent so the client has something
// to confirm against. Nothing is actually billed until that confirm
// succeeds; stripe-webhook is what flips organizations.subscription_status
// to 'active' once Stripe reports the invoice actually paid.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

// Real pilot pricing — agency only, $99/mo (founding agencies keep this
// rate forever, see organizations.founding_member). Phase 2 moves new
// (non-founding) agencies to $199/mo — when that happens, bump the
// number and pick a new lookupKey (e.g. "..._v2") so founding
// subscribers keep billing at their original price via their
// already-created Price object instead of silently jumping to the new
// rate; wire the actual founding-vs-new branch then, not guessed at here.
const PLAN_BY_ORG_TYPE: Record<string, { name: string; unitAmountCents: number; lookupKey: string }> = {
  agency: { name: "DVURE Agency Professional", unitAmountCents: 9900, lookupKey: "dvure_agency_professional_monthly" },
};

// Subscriptions (unlike Checkout Sessions) don't accept an inline
// product_data on price_data — a Subscription's price line item needs a
// real Price object referencing a real Product id. lookup_key is Stripe's
// own idiom for "create once, reuse forever": look it up first, and only
// create the Product+Price the very first time this plan is ever
// subscribed to on this Stripe account.
async function getOrCreatePriceId(plan: { name: string; unitAmountCents: number; lookupKey: string }): Promise<string> {
  const existing = await stripe.prices.list({ lookup_keys: [plan.lookupKey], active: true, limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;

  const product = await stripe.products.create({ name: plan.name });
  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: plan.unitAmountCents,
    recurring: { interval: "month" },
    product: product.id,
    lookup_key: plan.lookupKey,
  });
  return price.id;
}

function extractClientSecret(sub: Stripe.Subscription): string | null {
  const invoice = sub.latest_invoice;
  if (!invoice || typeof invoice === "string") return null;
  const pi = invoice.payment_intent;
  if (!pi || typeof pi === "string") return null;
  return pi.client_secret ?? null;
}

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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) throw new Error("Not signed in");

    const { data: membership, error: memErr } = await supabaseUser
      .from("org_memberships")
      .select("org_id, access_level")
      .eq("profile_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (memErr || !membership) throw new Error("No active org membership found for this user");
    if (membership.access_level !== "administrator") throw new Error("Only an org administrator can manage the subscription");

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select("id, name, org_type, subscription_status, stripe_customer_id, stripe_subscription_id")
      .eq("id", membership.org_id)
      .single();
    if (orgErr || !org) throw new Error("Organization not found");

    const plan = PLAN_BY_ORG_TYPE[org.org_type];
    if (!plan) throw new Error(`No subscription plan configured for org type ${org.org_type}`);

    if (org.subscription_status === "active") throw new Error("This organization already has an active subscription");

    // Resume an existing incomplete subscription rather than creating a
    // second one — same "call this again" posture as create-connect-account's
    // account-link resumption.
    if (org.stripe_subscription_id) {
      const existing = await stripe.subscriptions.retrieve(org.stripe_subscription_id, {
        expand: ["latest_invoice.payment_intent"],
      });
      if (existing.status === "incomplete") {
        const clientSecret = extractClientSecret(existing);
        if (clientSecret) {
          return new Response(
            JSON.stringify({ subscriptionId: existing.id, clientSecret }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
      }
      // Anything else (active/past_due/canceled/incomplete_expired) falls
      // through to creating a fresh subscription below.
    }

    let customerId = org.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: { org_id: org.id, org_type: org.org_type },
      });
      customerId = customer.id;
      const { error: updateErr } = await supabaseAdmin
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", org.id);
      if (updateErr) throw new Error(`Failed to save Stripe customer id: ${updateErr.message}`);
    }

    const priceId = await getOrCreatePriceId(plan);

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
      metadata: { org_id: org.id, org_type: org.org_type },
    });

    const { error: subUpdateErr } = await supabaseAdmin
      .from("organizations")
      .update({ stripe_subscription_id: subscription.id })
      .eq("id", org.id);
    if (subUpdateErr) throw new Error(`Failed to save Stripe subscription id: ${subUpdateErr.message}`);

    const clientSecret = extractClientSecret(subscription);
    if (!clientSecret) throw new Error("Stripe did not return a client secret for this subscription");

    return new Response(
      JSON.stringify({ subscriptionId: subscription.id, clientSecret }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
