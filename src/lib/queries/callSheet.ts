import { supabase } from "../supabaseClient";

export interface CallSheetAssignment {
  roleKey: string;
  crewPayeeId: string;
  fullName: string;
  discipline: string | null;
  isDepartmentLead: boolean;
}

export type CallSheetPermission = "admin" | "producer" | "lead" | "viewer" | null;

export interface CrewDirectoryEntry {
  id: string;
  fullName: string;
  email: string;
  discipline: string | null;
}

export async function fetchCallSheetSlots(campaignId: string): Promise<CallSheetAssignment[]> {
  const { data, error } = await supabase
    .from("campaign_crew_slots")
    .select("role_key, crew_payee_id, is_department_lead, crew_payees(full_name, discipline)")
    .eq("campaign_id", campaignId)
    .not("crew_payee_id", "is", null);
  if (error || !data) return [];
  return (data as any[])
    .filter((r) => r.crew_payees)
    .map((r) => ({
      roleKey: r.role_key,
      crewPayeeId: r.crew_payee_id,
      fullName: r.crew_payees.full_name,
      discipline: r.crew_payees.discipline,
      isDepartmentLead: r.is_department_lead,
    }));
}

// The caller's effective permission for this campaign's call sheet as a
// whole (no p_role_key) — used for coarse UI decisions (show the
// viewer-only banner, whether "Invite new" tab even makes sense). Each
// individual box re-checks its OWN role_key separately (a lead's
// permission varies box to box), and the server re-checks again on
// every write regardless of what the UI decided — this is a display
// hint, not the security boundary.
export async function fetchMyCallSheetRole(campaignId: string): Promise<CallSheetPermission> {
  const { data, error } = await supabase.rpc("my_call_sheet_role", { p_campaign_id: campaignId, p_role_key: null });
  if (error) return null;
  return (data as CallSheetPermission) ?? null;
}

export async function fetchMyRoleForKey(campaignId: string, roleKey: string): Promise<CallSheetPermission> {
  const { data, error } = await supabase.rpc("my_call_sheet_role", { p_campaign_id: campaignId, p_role_key: roleKey });
  if (error) return null;
  return (data as CallSheetPermission) ?? null;
}

export async function setDepartmentLead(campaignId: string, roleKey: string, isLead: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_department_lead", { p_campaign_id: campaignId, p_role_key: roleKey, p_is_lead: isLead });
  return { error: error?.message ?? null };
}

// "People we've worked with before" — scoped by RLS
// (crew_payees_select_via_brand_history, 0025) to crew ever assigned to
// one of the caller's own campaigns, not a global platform directory.
export async function fetchCrewDirectory(): Promise<CrewDirectoryEntry[]> {
  const { data, error } = await supabase
    .from("crew_payees")
    .select("id, full_name, email, discipline")
    .order("full_name", { ascending: true });
  if (error || !data) return [];
  return data.map((r: any) => ({ id: r.id, fullName: r.full_name, email: r.email, discipline: r.discipline }));
}

export async function assignCallSheetRole(campaignId: string, roleKey: string, crewPayeeId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("assign_call_sheet_role", {
    p_campaign_id: campaignId, p_role_key: roleKey, p_crew_payee_id: crewPayeeId,
  });
  return { error: error?.message ?? null };
}

export async function clearCallSheetRole(campaignId: string, roleKey: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("clear_call_sheet_role", { p_campaign_id: campaignId, p_role_key: roleKey });
  return { error: error?.message ?? null };
}

export interface CampaignNeedingLeads {
  campaignId: string;
  campaignName: string;
  filledCount: number;
}

// Real campaigns (not mock) with at least one filled call sheet role but
// zero department leads set anywhere on the sheet yet — surfaced as a
// Tasks entry so a brand admin doesn't forget to designate one. Grouped
// in JS rather than a view since a campaign with zero filled roles
// shouldn't show up here at all (nothing to lead yet).
export async function fetchCampaignsNeedingLeads(brandOrgId: string): Promise<CampaignNeedingLeads[]> {
  const { data, error } = await supabase
    .from("campaign_crew_slots")
    .select("campaign_id, is_department_lead, campaigns!inner(id, name, brand_org_id, status)")
    .not("crew_payee_id", "is", null)
    .eq("campaigns.brand_org_id", brandOrgId)
    .eq("campaigns.status", "active");
  if (error || !data) return [];

  const byCampaign = new Map<string, { name: string; filled: number; hasLead: boolean }>();
  for (const row of data as any[]) {
    const c = row.campaigns;
    if (!c) continue;
    const entry = byCampaign.get(c.id) ?? { name: c.name, filled: 0, hasLead: false };
    entry.filled += 1;
    if (row.is_department_lead) entry.hasLead = true;
    byCampaign.set(c.id, entry);
  }
  return [...byCampaign.entries()]
    .filter(([, v]) => !v.hasLead)
    .map(([campaignId, v]) => ({ campaignId, campaignName: v.name, filledCount: v.filled }));
}

export async function inviteCrewToCallSheet(
  campaignId: string, roleKey: string, fullName: string, email: string, discipline: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("invite_crew_to_call_sheet", {
    p_campaign_id: campaignId, p_role_key: roleKey, p_full_name: fullName, p_email: email, p_discipline: discipline,
  });
  return { error: error?.message ?? null };
}
