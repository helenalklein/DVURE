// Subscribes the caller's own org to its pilot plan. The price is
// re-derived server-side from the org's own org_type (never trusts a
// client-supplied price id) — same reasoning as create-invoice-payment
// recomputing charge amounts itself: the client only ever says "go",
// never "for how much" or "which plan".
//
// organizations.subscription_status/stripe_subscription_id are written
// directly here (admin client, needs 0057's grant) rather than waiting
// on a webhook — subscription creation is synchronous (Stripe returns
// its real status in the same response). A later status change (e.g. a
// renewal payment failing into past_due) is caught by stripe-webhook's
// own customer.subscription.updated/.deleted handling instead.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

const PRODUCT_NAME_BY_ORG_TYPE: Record<string, string> = {
  brand: "Brand Pilot Subscription",
  agency: "Agency Pilot Subscription",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const { paymentMethodId } = await req.json();
    if (!paymentMethodId || typeof paymentMethodId !== "string") throw new Error("paymentMethodId is required");

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
    if (!membership) throw new Error("No active organization membership found for this user");
    if (membership.access_level !== "administrator") throw new Error("Only an org administrator can manage the subscription");

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select("id, name, org_type, stripe_customer_id, stripe_subscription_id")
      .eq("id", membership.org_id)
      .single();
    if (orgErr || !org) throw new Error("Organization not found");
    if (org.stripe_subscription_id) throw new Error("This organization already has a subscription");

    const productName = PRODUCT_NAME_BY_ORG_TYPE[org.org_type as string];
    if (!productName) throw new Error(`No pilot subscription defined for org type ${org.org_type}`);

    const prices = await stripe.prices.list({ active: true, expand: ["data.product"], limit: 100 });
    const match = prices.data.find((p) => {
      const product = p.product as Stripe.Product;
      return typeof product === "object" && product.name === productName;
    });
    if (!match) throw new Error(`${productName} isn't configured in Stripe yet`);

    let customerId = org.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({ name: org.name, metadata: { org_id: org.id } });
      customerId = customer.id;
      const { error: updateCustomerErr } = await supabaseAdmin
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", org.id);
      if (updateCustomerErr) throw new Error(`Failed to save Stripe customer id: ${updateCustomerErr.message}`);
    }

    // Confirms the payment method actually belongs to this org's
    // customer before Stripe ever touches it — a stray or someone
    // else's payment method id fails here, not mid-subscription.
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (paymentMethod.customer !== customerId) throw new Error("That payment method doesn't belong to this organization");

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: match.id }],
      default_payment_method: paymentMethodId,
      metadata: { org_id: org.id },
    });

    // Map Stripe's real subscription statuses onto our narrower DB enum
    // (trialing|active|past_due|canceled) — anything ambiguous
    // (incomplete, incomplete_expired, unpaid, paused) defaults to
    // past_due, the gating state, never to something that would grant
    // access it hasn't actually earned.
    const dbStatus =
      subscription.status === "active" ? "active" :
      subscription.status === "trialing" ? "trialing" :
      subscription.status === "past_due" ? "past_due" :
      subscription.status === "canceled" || subscription.status === "incomplete_expired" ? "canceled" :
      "past_due";

    const { error: updateErr } = await supabaseAdmin
      .from("organizations")
      .update({ stripe_subscription_id: subscription.id, subscription_status: dbStatus })
      .eq("id", org.id);
    if (updateErr) throw new Error(`Subscribed in Stripe but failed to save locally: ${updateErr.message}`);

    return new Response(JSON.stringify({ status: subscription.status }), {
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
