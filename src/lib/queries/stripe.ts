import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";

// Both call real Supabase Edge Functions (supabase/functions/) — the
// client never talks to Stripe directly. supabase.functions.invoke()
// automatically attaches the current session's JWT, which each function
// uses to verify who's calling and which org they belong to.

// error.message from functions.invoke() is always the generic
// "Edge Function returned a non-2xx status code" — supabase-js doesn't
// read the response body itself. Both functions here return a real
// { error: "..." } JSON body on failure (see their own try/catch), so
// pull that out instead of surfacing the meaningless wrapper text,
// which was the only thing a brand saw when a payment failed.
async function functionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error as string;
    } catch {
      // response body wasn't JSON — fall through to the generic message
    }
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function startAgencyConnectOnboarding(): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke<{ url: string }>("create-connect-account");
  if (error) return { url: null, error: await functionErrorMessage(error) };
  return { url: data?.url ?? null, error: null };
}

export async function createInvoicePayment(
  bookingIds: string[],
  campaignId?: string
): Promise<{ invoiceId: string | null; clientSecret: string | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke<{ invoiceId: string; clientSecret: string }>(
    "create-invoice-payment",
    { body: { bookingIds, campaignId } }
  );
  if (error) return { invoiceId: null, clientSecret: null, error: await functionErrorMessage(error) };
  return { invoiceId: data?.invoiceId ?? null, clientSecret: data?.clientSecret ?? null, error: null };
}

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export async function createSetupIntent(): Promise<{ clientSecret: string | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke<{ clientSecret: string }>("create-setup-intent");
  if (error) return { clientSecret: null, error: await functionErrorMessage(error) };
  return { clientSecret: data?.clientSecret ?? null, error: null };
}

export async function listPaymentMethods(): Promise<{ cards: SavedCard[]; error: string | null }> {
  const { data, error } = await supabase.functions.invoke<{ cards: SavedCard[] }>("list-payment-methods");
  if (error) return { cards: [], error: await functionErrorMessage(error) };
  return { cards: data?.cards ?? [], error: null };
}

export interface SubscriptionPlan {
  priceId: string;
  productName: string;
  unitAmount: number | null;
  currency: string;
  interval: string | null;
}

export async function listSubscriptionPlan(): Promise<{ plan: SubscriptionPlan | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke<{ plan: SubscriptionPlan | null }>("list-subscription-plan");
  if (error) return { plan: null, error: await functionErrorMessage(error) };
  return { plan: data?.plan ?? null, error: null };
}

export async function createSubscription(paymentMethodId: string): Promise<{ status: string | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke<{ status: string }>(
    "create-subscription",
    { body: { paymentMethodId } }
  );
  if (error) return { status: null, error: await functionErrorMessage(error) };
  return { status: data?.status ?? null, error: null };
}
