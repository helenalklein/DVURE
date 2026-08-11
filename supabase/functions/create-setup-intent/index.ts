// Called by a brand administrator to save a real card for reuse against
// future invoice payments, instead of retyping one every time. Reuses
// organizations.stripe_customer_id (0014) — that column was originally
// added for subscription billing, which was never wired in, so it's
// sat unused; a Stripe Customer is a general billing identity, and a
// saved card is just as valid a thing to attach to it as a
// subscription, so there's no need for a second id column.
//
// This only ever creates the SetupIntent — the actual PaymentMethod is
// attached to the customer client-side once Stripe confirms the card
// (see AddCardStep.tsx), the same "client confirms, server only ever
// issued the intent" shape create-invoice-payment already uses.
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
      .select("org_id, access_level")
      .eq("profile_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (memErr || !membership) throw new Error("No active org membership found for this user");
    if (membership.access_level !== "administrator") throw new Error("Only an org administrator can add a payment card");

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select("id, name, stripe_customer_id")
      .eq("id", membership.org_id)
      .single();
    if (orgErr || !org) throw new Error("Organization not found");

    let customerId = org.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({ name: org.name, metadata: { org_id: org.id } });
      customerId = customer.id;
      const { error: updateErr } = await supabaseAdmin
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", org.id);
      if (updateErr) throw new Error(`Failed to save Stripe customer id: ${updateErr.message}`);
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      automatic_payment_methods: { enabled: true },
    });

    return new Response(JSON.stringify({ clientSecret: setupIntent.client_secret }), {
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
