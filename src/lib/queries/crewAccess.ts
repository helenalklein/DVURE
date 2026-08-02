import { supabase } from "../supabaseClient";

export interface CrewAccessDetails {
  grantId: string;
  payeeName: string;
  payeeDiscipline: string | null;
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  brandName: string;
  dueDate: string | null;
  expiresAt: string;
}

// The signed-in dashboard's own read — every grant this crew member has
// ever been issued, past and present alike. Scoped entirely by RLS
// (campaign_guest_access_select_self, 0024) to the caller's own
// crew_payees row; no explicit filter needed here.
export async function fetchMyCrewGrants(): Promise<CrewAccessDetails[]> {
  const { data, error } = await supabase
    .from("campaign_guest_access")
    .select(`
      id, expires_at,
      crew_payees(full_name, discipline),
      campaigns(id, name, status, due_date, organizations(name))
    `)
    .order("expires_at", { ascending: false });
  if (error || !data) return [];

  return (data as any[]).map((g) => ({
    grantId: g.id,
    payeeName: g.crew_payees?.full_name ?? "",
    payeeDiscipline: g.crew_payees?.discipline ?? null,
    campaignId: g.campaigns?.id ?? "",
    campaignName: g.campaigns?.name ?? "Unknown campaign",
    campaignStatus: g.campaigns?.status ?? "",
    brandName: g.campaigns?.organizations?.name ?? "",
    dueDate: g.campaigns?.due_date ?? null,
    expiresAt: g.expires_at,
  }));
}

export async function redeemCrewAccess(accessCode: string): Promise<{ data: CrewAccessDetails | null; error: string | null }> {
  const { data, error } = await supabase.rpc("redeem_crew_access", { p_access_code: accessCode });
  if (error || !data || data.length === 0) {
    return { data: null, error: error?.message ?? "This access link isn't valid." };
  }
  const row = data[0];
  return {
    data: {
      grantId: row.grant_id,
      payeeName: row.payee_name,
      payeeDiscipline: row.payee_discipline,
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      campaignStatus: row.campaign_status,
      brandName: row.brand_name,
      dueDate: row.due_date,
      expiresAt: row.expires_at,
    },
    error: null,
  };
}
