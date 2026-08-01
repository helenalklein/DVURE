import { supabase } from "../supabaseClient";

// Both call real Supabase Edge Functions (supabase/functions/) — the
// client never talks to Stripe directly. supabase.functions.invoke()
// automatically attaches the current session's JWT, which each function
// uses to verify who's calling and which org they belong to.

export async function startAgencyConnectOnboarding(): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke<{ url: string }>("create-connect-account");
  if (error) return { url: null, error: error.message };
  return { url: data?.url ?? null, error: null };
}

export async function authorizeBookingPayment(bookingId: string): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke<{ url: string }>("create-checkout-session", {
    body: { bookingId },
  });
  if (error) return { url: null, error: error.message };
  return { url: data?.url ?? null, error: null };
}
