import { supabase } from "../supabaseClient";

export type ManualPaymentMethod = "check" | "wire" | "cash";
export type PayeeKind = "agency" | "independent-model" | "crew";

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
  payeeKind: PayeeKind;
  payeeId: string;      // agency org id, model id, or crew payee id
  payeeName: string;
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

export type RecordManualPaymentParams = {
  campaignId: string;
  amount: number;
  method: ManualPaymentMethod;
  referenceNote?: string;
} & (
  | { payeeKind: "agency"; agencyOrgId: string }
  | { payeeKind: "independent-model"; modelId: string }
  | { payeeKind: "crew"; crewPayeeId: string }
);

export async function recordManualPayment(params: RecordManualPaymentParams): Promise<{ invoiceId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("record_manual_payment", {
    p_campaign_id: params.campaignId,
    p_amount: params.amount,
    p_method: params.method,
    p_reference_note: params.referenceNote ?? null,
    p_agency_org_id: params.payeeKind === "agency" ? params.agencyOrgId : null,
    p_model_id: params.payeeKind === "independent-model" ? params.modelId : null,
    p_crew_payee_id: params.payeeKind === "crew" ? params.crewPayeeId : null,
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

// invoice_line_items now has three mutually-exclusive payee columns
// (0051) — each embed is aliased so the row shape stays uniform
// regardless of which one is actually set.
const MANUAL_PAYMENT_SELECT = `
  id, campaign_id, status, total_amount, payment_method, reference_note,
  created_at, pending_at, accepted_at, voided_at, void_reason,
  campaigns(name),
  voided_by:profiles!invoices_voided_by_profile_id_fkey(full_name),
  invoice_line_items(
    payee_org_id, payee_model_id, payee_crew_payee_id, payee_confirmed_at,
    agency:organizations(id, name),
    model:model_profiles(id, full_name),
    crew:crew_payees(id, full_name),
    confirmed_by:profiles!invoice_line_items_payee_confirmed_by_profile_id_fkey(full_name)
  )
`;

function mapRow(r: any): ManualPayment {
  const line = r.invoice_line_items?.[0];
  const kind: PayeeKind = line?.payee_crew_payee_id ? "crew" : line?.payee_model_id ? "independent-model" : "agency";
  const payeeName = kind === "crew" ? line?.crew?.full_name : kind === "independent-model" ? line?.model?.full_name : line?.agency?.name;
  const payeeId = line?.payee_crew_payee_id ?? line?.payee_model_id ?? line?.payee_org_id ?? "";
  return {
    id: r.id,
    campaignId: r.campaign_id,
    campaignName: r.campaigns?.name ?? "Unknown campaign",
    payeeKind: kind,
    payeeId,
    payeeName: payeeName ?? "Unknown",
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

// Every manual payment a brand has recorded, any status, any payee kind
// — the brand's own record of what it's sent, confirmed or not.
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

// Same reconciliation queue, for a crew member confirming a direct
// payment themselves.
export async function fetchPendingConfirmationsForCrew(crewPayeeId: string): Promise<ManualPayment[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(MANUAL_PAYMENT_SELECT.replace("invoice_line_items(", "invoice_line_items!inner("))
    .eq("invoice_line_items.payee_crew_payee_id", crewPayeeId)
    .eq("status", "pending")
    .neq("payment_method", "card")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}

// Same reconciliation queue, for an independent model confirming a
// direct payment themselves.
export async function fetchPendingConfirmationsForModel(modelId: string): Promise<ManualPayment[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(MANUAL_PAYMENT_SELECT.replace("invoice_line_items(", "invoice_line_items!inner("))
    .eq("invoice_line_items.payee_model_id", modelId)
    .eq("status", "pending")
    .neq("payment_method", "card")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}
