import { supabase } from "../supabaseClient";

export type ManualPaymentMethod = "check" | "wire" | "cash";

// Mirrors payment_lifecycle_status (0047) minus 'paid' -- a manual
// payment never rests at 'paid' on its own (see 0047's header comment):
// it's either still 'pending' or already 'accepted', with paid_at set
// alongside accepted_at at the same instant. 'initiated' isn't reachable
// either, since recordManualPayment sets 'pending' directly.
export type ManualPaymentStatus = "pending" | "accepted" | "voided";

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
  createdAt: string;   // "Initiated" -- invoices.created_at
  pendingAt: string | null;
  acceptedAt: string | null;
  confirmedByName: string | null;
  voidedAt: string | null;
  voidedByName: string | null;
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
// constraint so PostgREST doesn't have to guess which one. Two separate
// FK paths into profiles too (who confirmed, who voided) — same reason
// each needs its own aliased embed.
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
    status: r.status === "accepted" ? "accepted" : r.status === "voided" ? "voided" : "pending",
    createdAt: r.created_at,
    pendingAt: r.pending_at,
    acceptedAt: r.accepted_at,
    confirmedByName: line?.confirmed_by?.full_name ?? null,
    voidedAt: r.voided_at,
    voidedByName: r.voided_by?.full_name ?? null,
    voidReason: r.void_reason,
  };
}

const MANUAL_PAYMENT_SELECT = `
  id, campaign_id, status, total_amount, payment_method, reference_note,
  created_at, pending_at, accepted_at, voided_at, void_reason,
  campaigns(name),
  voided_by:profiles!invoices_voided_by_profile_id_fkey(full_name),
  invoice_line_items(payee_org_id, payee_confirmed_at, organizations(id, name), confirmed_by:profiles!invoice_line_items_payee_confirmed_by_profile_id_fkey(full_name))
`;

// Every manual payment a brand has recorded, any status — the brand's
// own record of what it's sent, confirmed or not.
export async function fetchManualPaymentsForBrand(brandOrgId: string): Promise<ManualPayment[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(MANUAL_PAYMENT_SELECT)
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
    .select(MANUAL_PAYMENT_SELECT.replace("invoice_line_items(", "invoice_line_items!inner("))
    .eq("invoice_line_items.payee_org_id", agencyOrgId)
    .eq("status", "pending")
    .neq("payment_method", "card")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}
