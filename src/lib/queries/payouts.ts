import { supabase } from "../supabaseClient";

// One row per invoice_line_items entry naming this agency as payee —
// the actual Stripe Connect transfer record, not the invoice-level
// accepted/outstanding status (fetchInvoicesForBrand's Invoice type
// covers that). transfer_status is written only by stripe-webhook,
// never the client (0023's read-only posture).
export type TransferStatus = "pending" | "transferred" | "awaiting_payee_onboarding" | "failed";

export interface AgencyPayout {
  id: string;
  invoiceId: string;
  campaignName: string;
  brandName: string;
  grossAmount: number;
  payoutAmount: number;
  transferStatus: TransferStatus;
  transferredAt: string | null;
}

export async function fetchAgencyPayouts(agencyOrgId: string): Promise<AgencyPayout[]> {
  const { data, error } = await supabase
    .from("invoice_line_items")
    .select(`
      id, invoice_id, gross_amount, payout_amount, transfer_status, transferred_at,
      invoices(campaigns(name), organizations(name))
    `)
    .eq("payee_org_id", agencyOrgId)
    .order("transferred_at", { ascending: false, nullsFirst: false });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    id: r.id,
    invoiceId: r.invoice_id,
    campaignName: r.invoices?.campaigns?.name ?? "Unknown project",
    brandName: r.invoices?.organizations?.name ?? "Unknown brand",
    grossAmount: Number(r.gross_amount),
    payoutAmount: Number(r.payout_amount),
    transferStatus: r.transfer_status,
    transferredAt: r.transferred_at,
  }));
}
