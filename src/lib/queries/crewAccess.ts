import { supabase } from "../supabaseClient";

export interface CrewAccessDetails {
  grantId: string;
  payeeId: string | null;
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
      crew_payees(id, full_name, discipline),
      campaigns(id, name, status, due_date, organizations(name))
    `)
    .order("expires_at", { ascending: false });
  if (error || !data) return [];

  return (data as any[]).map((g) => ({
    grantId: g.id,
    payeeId: g.crew_payees?.id ?? null,
    payeeName: g.crew_payees?.full_name ?? "",
    payeeDiscipline: g.crew_payees?.discipline ?? null,
    campaignId: g.campaigns?.id ?? "",
    campaignName: g.campaigns?.name ?? "Unknown project",
    campaignStatus: g.campaigns?.status ?? "",
    brandName: g.campaigns?.organizations?.name ?? "",
    dueDate: g.campaigns?.due_date ?? null,
    expiresAt: g.expires_at,
  }));
}

// Self-service profile edits — crew_payees_update_self and
// profiles_update_self (0028/0002) both scope these to the caller's
// own row, so no id-ownership check is needed client-side. Two tables
// because crew_payees.full_name is the identity brands see on a call
// sheet (kept in sync here) while profiles is the account record.
export async function updateCrewPayee(payeeId: string, patch: { fullName?: string; discipline?: string | null }): Promise<{ error: string | null }> {
  const update: Record<string, unknown> = {};
  if (patch.fullName !== undefined) update.full_name = patch.fullName;
  if (patch.discipline !== undefined) update.discipline = patch.discipline;
  const { error } = await supabase.from("crew_payees").update(update).eq("id", payeeId);
  return { error: error?.message ?? null };
}

export async function updateMyProfile(profileId: string, patch: { fullName?: string; phone?: string }): Promise<{ error: string | null }> {
  const update: Record<string, unknown> = {};
  if (patch.fullName !== undefined) update.full_name = patch.fullName;
  if (patch.phone !== undefined) update.phone = patch.phone;
  const { error } = await supabase.from("profiles").update(update).eq("id", profileId);
  return { error: error?.message ?? null };
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
      // This is the no-login emergency-access path — there's no
      // auth.uid() session for a payment-confirm queue to scope to
      // here anyway, so payeeId is never populated on this branch.
      payeeId: null,
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
