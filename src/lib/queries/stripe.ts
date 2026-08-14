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

export async function createSubscriptionCheckout(): Promise<{ subscriptionId: string | null; clientSecret: string | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke<{ subscriptionId: string; clientSecret: string }>(
    "create-subscription-checkout"
  );
  if (error) return { subscriptionId: null, clientSecret: null, error: error.message };
  return { subscriptionId: data?.subscriptionId ?? null, clientSecret: data?.clientSecret ?? null, error: null };
}

export interface InvoicePaymentResult {
  invoiceId: string | null;
  clientSecret: string | null;
  grossAmount: number | null;
  platformFeePct: number | null;
  platformFeeAmount: number | null;
  totalAmount: number | null;
  error: string | null;
}

export async function createInvoicePayment(
  bookingIds: string[],
  chargeMethod: "ach" | "card",
  campaignId?: string
): Promise<InvoicePaymentResult> {
  const { data, error } = await supabase.functions.invoke<{
    invoiceId: string; clientSecret: string; grossAmount: number; platformFeePct: number; platformFeeAmount: number; totalAmount: number;
  }>("create-invoice-payment", { body: { bookingIds, campaignId, chargeMethod } });
  if (error) {
    return { invoiceId: null, clientSecret: null, grossAmount: null, platformFeePct: null, platformFeeAmount: null, totalAmount: null, error: error.message };
  }
  return {
    invoiceId: data?.invoiceId ?? null,
    clientSecret: data?.clientSecret ?? null,
    grossAmount: data?.grossAmount ?? null,
    platformFeePct: data?.platformFeePct ?? null,
    platformFeeAmount: data?.platformFeeAmount ?? null,
    totalAmount: data?.totalAmount ?? null,
    error: null,
  };
}
