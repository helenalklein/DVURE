import { supabase } from "../supabaseClient";
import { ALL_CALL_SHEET_ROLES } from "../../app/shared/callSheetRoles";

function roleLabel(roleKey: string): string {
  return ALL_CALL_SHEET_ROLES.find(r => r.key === roleKey)?.label ?? roleKey;
}

export type PayeeKind = "agency-model" | "independent-model" | "crew";
// unpaid — nothing recorded yet. pending — recorded, no confirmation yet
// (0 accepted). partial — some accepted, less than the full amount.
// paid — accepted amount covers the full amount. Derived from the sum of
// this payee's invoice_payments (0053), not a single stored status.
export type OutstandingStatus = "unpaid" | "pending" | "partial" | "paid";

export interface OutstandingPayee {
  key: string;
  kind: PayeeKind;
  name: string;
  subLabel: string;
  totalAmount: number;
  acceptedAmount: number;
  pendingAmount: number;
  remaining: number; // totalAmount - accepted - pending — what a new payment can still cover
  status: OutstandingStatus;
  agencyOrgId: string | null;
  modelId: string | null;
  crewPayeeId: string | null;
  invoiceId: string | null; // the open (not-yet-fully-paid) invoice to add another payment to, if one exists
  bookingId: string | null; // the real bookings row backing this row — null for crew, needed to pay by card
}

function statusFor(accepted: number, pending: number, total: number): OutstandingStatus {
  if (accepted >= total && total > 0) return "paid";
  if (accepted > 0) return "partial";
  if (pending > 0) return "pending";
  return "unpaid";
}

// One spreadsheet row per real person the brand owes money to on this
// campaign — a repped model (paid through their agency), an independent
// model (paid directly), or a crew member with a rate set on their call
// sheet slot. Payment progress is summed across every invoice_payments
// row on that payee's invoice(s) for this campaign (0053) — a payee can
// now be paid in installments and this reflects the running balance, not
// just whether a single payment happened.
export async function fetchOutstandingPayees(campaignId: string): Promise<OutstandingPayee[]> {
  const [{ data: bookings }, { data: slots }, { data: invoices }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, day_rate, days, agency_org_id, model_id, model_profiles(full_name), organizations!bookings_agency_org_id_fkey(name)")
      .eq("campaign_id", campaignId),
    supabase
      .from("campaign_crew_slots")
      .select("role_key, rate, crew_payee_id, crew_payees(id, full_name, discipline)")
      .eq("campaign_id", campaignId)
      .not("crew_payee_id", "is", null),
    supabase
      .from("invoices")
      .select("id, status, created_at, invoice_line_items(payee_org_id, payee_model_id, payee_crew_payee_id), invoice_payments(amount, status)")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false }),
  ]);

  function invoicesFor(match: (li: any) => boolean): any[] {
    return ((invoices as any[]) ?? []).filter(inv => (inv.invoice_line_items ?? []).some(match));
  }

  function progressFor(match: (li: any) => boolean): { accepted: number; pending: number; openInvoiceId: string | null } {
    const matches = invoicesFor(match);
    let accepted = 0, pending = 0;
    let openInvoiceId: string | null = null;
    for (const inv of matches) {
      for (const p of inv.invoice_payments ?? []) {
        if (p.status === "accepted") accepted += Number(p.amount);
        else if (p.status === "pending") pending += Number(p.amount);
      }
      if (inv.status !== "paid" && openInvoiceId === null) openInvoiceId = inv.id;
    }
    return { accepted, pending, openInvoiceId };
  }

  const rows: OutstandingPayee[] = [];

  for (const b of (bookings as any[]) ?? []) {
    const isIndependent = !b.agency_org_id;
    const totalAmount = Number(b.day_rate) * Number(b.days); // gross owed — the same figure create-invoice-payment recomputes server-side for a card charge
    const match = isIndependent
      ? (li: any) => li.payee_model_id === b.model_id
      : (li: any) => li.payee_org_id === b.agency_org_id;
    const { accepted, pending, openInvoiceId } = progressFor(match);
    rows.push({
      key: `booking-${b.id}`,
      kind: isIndependent ? "independent-model" : "agency-model",
      name: b.model_profiles?.full_name ?? "Unknown",
      subLabel: isIndependent ? "Independent" : (b.organizations?.name ?? "Unknown agency"),
      totalAmount, acceptedAmount: accepted, pendingAmount: pending,
      remaining: Math.max(0, totalAmount - accepted - pending),
      status: statusFor(accepted, pending, totalAmount),
      agencyOrgId: b.agency_org_id,
      modelId: b.model_id,
      crewPayeeId: null,
      invoiceId: openInvoiceId,
      bookingId: b.id,
    });
  }

  for (const s of (slots as any[]) ?? []) {
    if (s.rate == null) continue; // no rate set yet — not owed anything until production enters one
    const payee = s.crew_payees;
    if (!payee) continue;
    const totalAmount = Number(s.rate);
    const { accepted, pending, openInvoiceId } = progressFor((li: any) => li.payee_crew_payee_id === payee.id);
    rows.push({
      key: `crew-${s.role_key}`,
      kind: "crew",
      name: payee.full_name,
      subLabel: roleLabel(s.role_key) ?? payee.discipline ?? "Crew",
      totalAmount, acceptedAmount: accepted, pendingAmount: pending,
      remaining: Math.max(0, totalAmount - accepted - pending),
      status: statusFor(accepted, pending, totalAmount),
      agencyOrgId: null,
      modelId: null,
      crewPayeeId: payee.id,
      invoiceId: openInvoiceId,
      bookingId: null,
    });
  }

  return rows;
}
