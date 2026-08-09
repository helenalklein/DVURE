import { supabase } from "../supabaseClient";

export type ManualPaymentMethod = "check" | "wire" | "cash";
export type ManualPaymentStatus = "pending" | "paid" | "canceled"; // canceled == voided, for manual payments

export interface ManualPayment {
  id: string;
  campaignId: string;
  campaignName: string;
  agencyOrgId: string;
  agencyName: string;
  amount: number;
  method: ManualPaymentMethod;
  referenceNote: string | null;
  status: ManualPaymentStatus;
  createdAt: string;
  confirmedAt: string | null;
  voidReason: string | null;
}

export async function recordManualPayment(params: {
  campaignId: string;
  agencyOrgId: string;
  amount: number;
  method: ManualPaymentMethod;
  referenceNote?: string;
}): Promise<{ invoiceId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("record_manual_payment", {
    p_campaign_id: params.campaignId,
    p_agency_org_id: params.agencyOrgId,
    p_amount: params.amount,
    p_method: params.method,
    p_reference_note: params.referenceNote ?? null,
  });
  if (error || !data) return { invoiceId: null, error: error?.message ?? "Couldn't record payment." };
  return { invoiceId: data as string, error: null };
}

export async function confirmManualPayment(invoiceId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("confirm_manual_payment", { p_invoice_id: invoiceId });
  return { error: error?.message ?? null };
}

export async function voidManualPayment(invoiceId: string, reason: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("void_manual_payment", { p_invoice_id: invoiceId, p_reason: reason });
  return { error: error?.message ?? null };
}

// invoices has two FK paths into organizations (brand_org_id here,
// payee_org_id on the line item) — embeds below name the specific
// constraint so PostgREST doesn't have to guess which one.
function mapRow(r: any): ManualPayment {
  const line = r.invoice_line_items?.[0];
  return {
    id: r.id,
    campaignId: r.campaign_id,
    campaignName: r.campaigns?.name ?? "Unknown campaign",
    agencyOrgId: line?.payee_org_id ?? "",
    agencyName: line?.organizations?.name ?? "Unknown agency",
    amount: Number(r.total_amount),
    method: r.payment_method,
    referenceNote: r.reference_note,
    status: r.status === "paid" ? "paid" : r.status === "canceled" ? "canceled" : "pending",
    createdAt: r.created_at,
    confirmedAt: line?.payee_confirmed_at ?? null,
    voidReason: r.void_reason,
  };
}

// Every manual payment a brand has recorded, any status — the brand's
// own record of what it's sent, confirmed or not.
export async function fetchManualPaymentsForBrand(brandOrgId: string): Promise<ManualPayment[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id, campaign_id, status, total_amount, payment_method, reference_note, created_at, void_reason,
      campaigns(name),
      invoice_line_items(payee_org_id, payee_confirmed_at, organizations(id, name))
    `)
    .eq("brand_org_id", brandOrgId)
    .neq("payment_method", "card")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}

// Manual payments naming this agency as payee, still awaiting its
// confirmation — the reconciliation queue.
export async function fetchPendingConfirmationsForAgency(agencyOrgId: string): Promise<ManualPayment[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id, campaign_id, status, total_amount, payment_method, reference_note, created_at, void_reason,
      campaigns(name),
      invoice_line_items!inner(payee_org_id, payee_confirmed_at, organizations(id, name))
    `)
    .eq("invoice_line_items.payee_org_id", agencyOrgId)
    .eq("status", "pending")
    .neq("payment_method", "card")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}
