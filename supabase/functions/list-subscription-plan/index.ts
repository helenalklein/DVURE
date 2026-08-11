// Returns the one Stripe price relevant to the caller's own org type —
// a brand only ever sees "Brand Pilot Subscription", an agency only
// "Agency Pilot Subscription". Looked up by product name against
// Stripe directly rather than a hardcoded price id, since the pilot
// products were created by hand in the dashboard and their ids aren't
// checked into this repo anywhere.
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
      .select("org_id")
      .eq("profile_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) throw new Error("No active organization membership found for this user");

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select("org_type")
      .eq("id", membership.org_id)
      .single();
    if (orgErr || !org) throw new Error("Organization not found");

    const productName = PRODUCT_NAME_BY_ORG_TYPE[org.org_type as string];
    if (!productName) throw new Error(`No pilot subscription defined for org type ${org.org_type}`);

    const prices = await stripe.prices.list({ active: true, expand: ["data.product"], limit: 100 });
    const match = prices.data.find((p) => {
      const product = p.product as Stripe.Product;
      return typeof product === "object" && product.name === productName;
    });

    if (!match) {
      return new Response(JSON.stringify({ plan: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const product = match.product as Stripe.Product;
    return new Response(
      JSON.stringify({
        plan: {
          priceId: match.id,
          productName: product.name,
          unitAmount: match.unit_amount,
          currency: match.currency,
          interval: match.recurring?.interval ?? null,
        },
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
