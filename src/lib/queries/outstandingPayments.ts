import { supabase } from "../supabaseClient";
import { ALL_CALL_SHEET_ROLES } from "../../app/shared/callSheetRoles";

function roleLabel(roleKey: string): string {
  return ALL_CALL_SHEET_ROLES.find(r => r.key === roleKey)?.label ?? roleKey;
}

export type PayeeKind = "agency-model" | "independent-model" | "crew";
export type OutstandingStatus = "unpaid" | "pending" | "accepted" | "voided";

export interface OutstandingPayee {
  key: string;
  kind: PayeeKind;
  name: string;
  subLabel: string;
  amount: number;
  agencyOrgId: string | null;
  modelId: string | null;
  crewPayeeId: string | null;
  status: OutstandingStatus;
  invoiceId: string | null;
}

// One spreadsheet row per real person the brand owes money to on this
// campaign — a repped model (paid through their agency), an independent
// model (paid directly), or a crew member with a rate set on their call
// sheet slot. Status comes from the most recent non-voided manual
// invoice naming that exact payee on this campaign, defaulting to
// "unpaid" when none exists yet.
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
      .select("id, status, created_at, invoice_line_items(payee_org_id, payee_model_id, payee_crew_payee_id)")
      .eq("campaign_id", campaignId)
      .neq("payment_method", "card")
      .order("created_at", { ascending: false }),
  ]);

  function latestInvoiceFor(match: (li: any) => boolean): { id: string; status: OutstandingStatus } | null {
    for (const inv of (invoices as any[]) ?? []) {
      const line = (inv.invoice_line_items ?? []).find(match);
      if (line) return { id: inv.id, status: inv.status === "accepted" ? "accepted" : inv.status === "voided" ? "voided" : "pending" };
    }
    return null;
  }

  const rows: OutstandingPayee[] = [];

  for (const b of (bookings as any[]) ?? []) {
    const isIndependent = !b.agency_org_id;
    const amount = Number(b.day_rate) * Number(b.days); // gross owed — matches fetchUnpaidBookings' grossAmount
    const match = isIndependent
      ? (li: any) => li.payee_model_id === b.model_id
      : (li: any) => li.payee_org_id === b.agency_org_id;
    const inv = latestInvoiceFor(match);
    rows.push({
      key: `booking-${b.id}`,
      kind: isIndependent ? "independent-model" : "agency-model",
      name: b.model_profiles?.full_name ?? "Unknown",
      subLabel: isIndependent ? "Independent" : (b.organizations?.name ?? "Unknown agency"),
      amount,
      agencyOrgId: b.agency_org_id,
      modelId: b.model_id,
      crewPayeeId: null,
      status: inv?.status ?? "unpaid",
      invoiceId: inv?.id ?? null,
    });
  }

  for (const s of (slots as any[]) ?? []) {
    if (s.rate == null) continue; // no rate set yet — not owed anything until production enters one
    const payee = s.crew_payees;
    if (!payee) continue;
    const inv = latestInvoiceFor((li: any) => li.payee_crew_payee_id === payee.id);
    rows.push({
      key: `crew-${s.role_key}`,
      kind: "crew",
      name: payee.full_name,
      subLabel: roleLabel(s.role_key) ?? payee.discipline ?? "Crew",
      amount: Number(s.rate),
      agencyOrgId: null,
      modelId: null,
      crewPayeeId: payee.id,
      status: inv?.status ?? "unpaid",
      invoiceId: inv?.id ?? null,
    });
  }

  return rows;
}
