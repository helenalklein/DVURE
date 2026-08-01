// Called by an agency administrator to start (or resume) Stripe Connect
// onboarding for their own org. Creates the Express account once, then
// always returns a fresh onboarding link — Stripe account-links expire
// after a few minutes, so "resume onboarding" is just "call this again."
//
// Auth model: the incoming request carries the caller's own JWT (the
// client SDK does this automatically via supabase.functions.invoke()).
// We verify it against Supabase directly, then look up the caller's org
// membership the same way every RLS policy in this schema does — this
// function only ever acts on the CALLER's own org, never a org id passed
// in from the client.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    // Two clients: one scoped to the caller (to find out who they are),
    // one with the service role (to actually write — organizations only
    // grants clients update on `name`, per 0019/0022's own design).
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
    if (membership.access_level !== "administrator") throw new Error("Only an org administrator can set up payouts");

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select("id, name, org_type, stripe_connect_account_id")
      .eq("id", membership.org_id)
      .single();
    if (orgErr || !org) throw new Error("Organization not found");
    if (org.org_type !== "agency") throw new Error("Only agencies onboard for payouts in this first pass");

    let accountId = org.stripe_connect_account_id as string | null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        business_type: "company",
        company: { name: org.name },
        capabilities: {
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      const { error: updateErr } = await supabaseAdmin
        .from("organizations")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", org.id);
      if (updateErr) throw new Error(`Failed to save Connect account id: ${updateErr.message}`);
    }

    const origin = req.headers.get("origin") ?? "https://dvure.com";
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/agency?stripe_onboarding=refresh`,
      return_url: `${origin}/agency?stripe_onboarding=complete`,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url }), {
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
