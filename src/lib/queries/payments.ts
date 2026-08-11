import { supabase } from "../supabaseClient";

export type ManualPaymentMethod = "check" | "wire" | "cash";
// A real payment event's method — manual (brand records it, payee
// confirms) or electronic (Stripe PaymentIntent, written by the
// webhook only once Stripe itself confirms success — see 0054 and
// stripe-webhook's header for why these never pass through a 'pending'
// state a human needs to confirm). ACH and card are priced differently
// (create-invoice-payment) even though both are "electronic" here.
export type ElectronicPaymentMethod = "card" | "ach";
export type PaymentMethod = ManualPaymentMethod | ElectronicPaymentMethod;
export type PayeeKind = "agency" | "independent-model" | "crew";

// A single payment event applied against an invoice. Mirrors
// payment_lifecycle_status (0047) minus 'paid' -- a manual payment never
// rests at 'paid' on its own: it's either still 'pending' or already
// 'accepted', with paid_at set alongside accepted_at at the same instant
// (see 0047's header). 'initiated' isn't reachable either, since
// recordInvoicePayment sets 'pending' directly; a card payment only ever
// appears already 'accepted' (see stripe-webhook).
export type InvoicePaymentStatus = "pending" | "accepted" | "voided";

export interface InvoicePayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  referenceNote: string | null;
  status: InvoicePaymentStatus;
  createdAt: string; // "Initiated"
  pendingAt: string | null;
  acceptedAt: string | null;
  confirmedByName: string | null;
  signatureName: string | null;
  signatureCapturedAt: string | null;
  voidedAt: string | null;
  voidedByName: string | null;
  voidReason: string | null;
}

// invoice_payments' status can go paid before the invoice itself does --
// an invoice covers everything owed to one payee on one campaign and can
// take many payments over time (0053). outstanding/partially_paid/paid
// are derived server-side from the sum of accepted payments vs.
// totalAmount; there's no "voided" at this level -- a voided payment
// just never counted toward the balance.
export type InvoiceStatus = "outstanding" | "partially_paid" | "paid";

export interface Invoice {
  id: string;
  campaignId: string;
  campaignName: string;
  payeeKind: PayeeKind;
  payeeId: string; // agency org id, model id, or crew payee id
  payeeName: string;
  totalAmount: number;
  acceptedAmount: number;
  status: InvoiceStatus;
  createdAt: string;
  payments: InvoicePayment[];
}

export type RecordInvoicePaymentParams = {
  campaignId: string;
  invoiceTotal: number; // full amount owed -- only used if a new invoice must be created
  amount: number;
  method: ManualPaymentMethod;
  referenceNote?: string;
} & (
  | { payeeKind: "agency"; agencyOrgId: string }
  | { payeeKind: "independent-model"; modelId: string }
  | { payeeKind: "crew"; crewPayeeId: string }
);

export async function recordInvoicePayment(params: RecordInvoicePaymentParams): Promise<{ paymentId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("record_invoice_payment", {
    p_campaign_id: params.campaignId,
    p_invoice_total: params.invoiceTotal,
    p_amount: params.amount,
    p_method: params.method,
    p_reference_note: params.referenceNote ?? null,
    p_agency_org_id: params.payeeKind === "agency" ? params.agencyOrgId : null,
    p_model_id: params.payeeKind === "independent-model" ? params.modelId : null,
    p_crew_payee_id: params.payeeKind === "crew" ? params.crewPayeeId : null,
  });
  if (error || !data) return { paymentId: null, error: error?.message ?? "Couldn't record payment." };
  return { paymentId: data as string, error: null };
}

export async function confirmInvoicePayment(paymentId: string, signatureName: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("confirm_invoice_payment", { p_payment_id: paymentId, p_signature_name: signatureName });
  return { error: error?.message ?? null };
}

export async function voidInvoicePayment(paymentId: string, reason: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("void_invoice_payment", { p_payment_id: paymentId, p_reason: reason });
  return { error: error?.message ?? null };
}

// invoice_line_items has three mutually-exclusive payee columns (0051) —
// each embed is aliased so the row shape stays uniform regardless of
// which one is actually set.
// !inner (not a plain left join) is what lets fetchInvoicesForCrewPayee
// below filter on this embed's payee_crew_payee_id — safe because
// every invoice always has exactly one line item (0051's one-invoice-
// per-payee design), so switching join type changes nothing for the
// brand/id-scoped fetches that don't filter on it.
const INVOICE_SELECT = `
  id, campaign_id, status, total_amount, created_at,
  campaigns(name),
  invoice_line_items!inner(
    payee_org_id, payee_model_id, payee_crew_payee_id,
    agency:organizations(id, name),
    model:model_profiles(id, full_name),
    crew:crew_payees(id, full_name)
  ),
  invoice_payments(
    id, amount, payment_method, reference_note, status,
    created_at, pending_at, accepted_at, voided_at, void_reason,
    signature_name, signature_captured_at,
    confirmed_by:profiles!invoice_payments_payee_confirmed_by_profile_id_fkey(full_name),
    voided_by:profiles!invoice_payments_voided_by_profile_id_fkey(full_name)
  )
`;

function mapRow(r: any): Invoice {
  const line = r.invoice_line_items?.[0];
  const kind: PayeeKind = line?.payee_crew_payee_id ? "crew" : line?.payee_model_id ? "independent-model" : "agency";
  const payeeName = kind === "crew" ? line?.crew?.full_name : kind === "independent-model" ? line?.model?.full_name : line?.agency?.name;
  const payeeId = line?.payee_crew_payee_id ?? line?.payee_model_id ?? line?.payee_org_id ?? "";

  const payments: InvoicePayment[] = ((r.invoice_payments ?? []) as any[])
    .map((p): InvoicePayment => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.payment_method,
      referenceNote: p.reference_note,
      status: p.status === "accepted" ? "accepted" : p.status === "voided" ? "voided" : "pending",
      createdAt: p.created_at,
      pendingAt: p.pending_at,
      acceptedAt: p.accepted_at,
      confirmedByName: p.confirmed_by?.full_name ?? null,
      signatureName: p.signature_name ?? null,
      signatureCapturedAt: p.signature_captured_at ?? null,
      voidedAt: p.voided_at,
      voidedByName: p.voided_by?.full_name ?? null,
      voidReason: p.void_reason,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const acceptedAmount = payments.filter(p => p.status === "accepted").reduce((s, p) => s + p.amount, 0);

  return {
    id: r.id,
    campaignId: r.campaign_id,
    campaignName: r.campaigns?.name ?? "Unknown campaign",
    payeeKind: kind,
    payeeId,
    payeeName: payeeName ?? "Unknown",
    totalAmount: Number(r.total_amount),
    acceptedAmount,
    status: r.status === "paid" ? "paid" : r.status === "partially_paid" ? "partially_paid" : "outstanding",
    createdAt: r.created_at,
    payments,
  };
}

// Every invoice a brand has, any status — the brand's own record of what
// it owes and what's been paid toward it so far.
export async function fetchInvoicesForBrand(brandOrgId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("brand_org_id", brandOrgId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}

// One invoice with its full payment trail — used to open the detail/
// trail view directly from a spreadsheet row that already knows its
// invoiceId (fetchOutstandingPayees) without refetching the whole list.
export async function fetchInvoiceById(invoiceId: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("id", invoiceId)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as any);
}

// A crew member's full payment history — every invoice naming this
// crew_payees row as payee, any status, not just the pending ones
// (fetchPendingConfirmationsForCrew). A crew member can hold a
// distinct crew_payees row per campaign, so the caller merges this
// across every payeeId from their own grants the same way it already
// does for the pending queue.
export async function fetchInvoicesForCrewPayee(crewPayeeId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("invoice_line_items.payee_crew_payee_id", crewPayeeId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}

// One flat row per payment event awaiting this payee's confirmation —
// not a full Invoice, since the inner-join filter below only returns the
// pending payment(s) on each matching invoice, and an invoice can have
// other accepted/voided payments alongside them that this list
// deliberately doesn't touch.
export interface PendingConfirmation {
  paymentId: string;
  invoiceId: string;
  campaignName: string;
  amount: number;
  method: ManualPaymentMethod;
  referenceNote: string | null;
  createdAt: string;
}

const PENDING_CONFIRMATION_SELECT = `
  invoice_payments!inner(id, amount, payment_method, reference_note, created_at),
  campaigns(name)
`;

function mapPendingConfirmations(rows: any[]): PendingConfirmation[] {
  return rows.flatMap(r => (r.invoice_payments ?? []).map((p: any) => ({
    paymentId: p.id,
    invoiceId: r.id,
    campaignName: r.campaigns?.name ?? "Unknown campaign",
    amount: Number(p.amount),
    method: p.payment_method,
    referenceNote: p.reference_note,
    createdAt: p.created_at,
  })));
}

// Invoices naming this agency as payee that still have at least one
// payment awaiting its confirmation — the reconciliation queue.
export async function fetchPendingConfirmationsForAgency(agencyOrgId: string): Promise<PendingConfirmation[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(`id, ${PENDING_CONFIRMATION_SELECT}, invoice_line_items!inner(payee_org_id)`)
    .eq("invoice_line_items.payee_org_id", agencyOrgId)
    .eq("invoice_payments.status", "pending")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return mapPendingConfirmations(data as any[]);
}

// Same reconciliation queue, for a crew member confirming a direct
// payment themselves.
export async function fetchPendingConfirmationsForCrew(crewPayeeId: string): Promise<PendingConfirmation[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(`id, ${PENDING_CONFIRMATION_SELECT}, invoice_line_items!inner(payee_crew_payee_id)`)
    .eq("invoice_line_items.payee_crew_payee_id", crewPayeeId)
    .eq("invoice_payments.status", "pending")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return mapPendingConfirmations(data as any[]);
}

// Same reconciliation queue, for an independent model confirming a
// direct payment themselves.
export async function fetchPendingConfirmationsForModel(modelId: string): Promise<PendingConfirmation[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(`id, ${PENDING_CONFIRMATION_SELECT}, invoice_line_items!inner(payee_model_id)`)
    .eq("invoice_line_items.payee_model_id", modelId)
    .eq("invoice_payments.status", "pending")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return mapPendingConfirmations(data as any[]);
}
