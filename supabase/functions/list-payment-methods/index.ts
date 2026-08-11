// Every card actually saved against the caller's org, straight from
// Stripe — no local cache/mirror table. Volume per org is a handful of
// cards at most, so a live list call on each page load is simpler than
// keeping a synced copy in sync with adds/removals/expirations.
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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) throw new Error("Not signed in");

    const { data: membership, error: memErr } = await supabaseUser
      .from("org_memberships")
      .select("org_id")
      .eq("profile_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (memErr || !membership) throw new Error("No active org membership found for this user");

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", membership.org_id)
      .single();
    if (orgErr || !org) throw new Error("Organization not found");

    if (!org.stripe_customer_id) {
      return new Response(JSON.stringify({ cards: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const methods = await stripe.paymentMethods.list({ customer: org.stripe_customer_id as string, type: "card" });
    const cards = methods.data.map((m) => ({
      id: m.id,
      brand: m.card?.brand ?? "unknown",
      last4: m.card?.last4 ?? "0000",
      expMonth: m.card?.exp_month ?? 0,
      expYear: m.card?.exp_year ?? 0,
    }));

    return new Response(JSON.stringify({ cards }), {
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
