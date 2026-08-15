import { supabase } from "../supabaseClient";

export interface CallSheetAssignment {
  roleKey: string;
  crewPayeeId: string;
  fullName: string;
  discipline: string | null;
  isDepartmentLead: boolean;
  isProjectAdmin: boolean;
  rate: number | null;
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
    .select("role_key, crew_payee_id, is_department_lead, is_project_admin, rate, crew_payees(full_name, discipline)")
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
      isProjectAdmin: !!r.is_project_admin,
      rate: r.rate != null ? Number(r.rate) : null,
    }));
}

// Rate lives on the slot (this specific role, this specific campaign),
// not on crew_payees itself — the same person can charge differently
// job to job. Editable by production up to and after the shoot for as
// long as the campaign stays open (0051) -- deliberately looser than
// the model rate workflow, which locks at booking.
export async function updateCrewSlotRate(campaignId: string, roleKey: string, rate: number | null): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("update_crew_slot_rate", { p_campaign_id: campaignId, p_role_key: roleKey, p_rate: rate });
  return { error: error?.message ?? null };
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

export async function setProjectAdmin(campaignId: string, roleKey: string, isAdmin: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_project_admin", { p_campaign_id: campaignId, p_role_key: roleKey, p_is_admin: isAdmin });
  return { error: error?.message ?? null };
}

export interface CustomCrewRole {
  roleKey: string;
  roleLabel: string;
  categoryKey: string;
  categoryLabel: string | null;
}

// Custom departments/roles a project has added beyond the fixed 48 —
// discovered from what's actually on THIS campaign's crew slots (custom
// role_keys are globally unique, generated per-add, so this naturally
// scopes to just this project's own custom entries even though
// call_sheet_role_categories itself is a shared table). Two-step: find
// this campaign's custom role_keys, then separately resolve each
// role's category label from the category's own self-referencing row
// (role_key === category_key) — the label lives there, not repeated on
// every role row.
export async function fetchCustomCrewRoles(campaignId: string): Promise<CustomCrewRole[]> {
  const { data: slots, error } = await supabase
    .from("campaign_crew_slots")
    .select("role_key")
    .eq("campaign_id", campaignId);
  if (error || !slots || slots.length === 0) return [];
  const roleKeys = slots.map((s: any) => s.role_key);

  const { data: roles } = await supabase
    .from("call_sheet_role_categories")
    .select("role_key, category_key, role_label")
    .in("role_key", roleKeys)
    .eq("is_custom", true);
  if (!roles || roles.length === 0) return [];

  const categoryKeys = [...new Set(roles.map((r: any) => r.category_key))];
  const { data: catRows } = await supabase
    .from("call_sheet_role_categories")
    .select("role_key, category_label")
    .in("role_key", categoryKeys);
  const labelByCategoryKey = new Map((catRows ?? []).map((r: any) => [r.role_key, r.category_label]));

  return (roles as any[]).map(r => ({
    roleKey: r.role_key,
    roleLabel: r.role_label ?? r.role_key,
    categoryKey: r.category_key,
    categoryLabel: labelByCategoryKey.get(r.category_key) ?? null,
  }));
}

// Just the custom departments themselves (deduped), for rendering
// category headers/the "+" bar without needing the individual roles.
export async function fetchCustomCrewCategories(campaignId: string): Promise<{ categoryKey: string; categoryLabel: string }[]> {
  const roles = await fetchCustomCrewRoles(campaignId);
  const seen = new Map<string, string>();
  for (const r of roles) {
    if (r.categoryLabel && !seen.has(r.categoryKey)) seen.set(r.categoryKey, r.categoryLabel);
  }
  return [...seen.entries()].map(([categoryKey, categoryLabel]) => ({ categoryKey, categoryLabel }));
}

export async function addCustomCrewRole(params: {
  campaignId: string; roleLabel: string; categoryKey?: string; newCategoryLabel?: string;
}): Promise<{ roleKey: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("add_custom_crew_role", {
    p_campaign_id: params.campaignId,
    p_role_label: params.roleLabel,
    p_category_key: params.categoryKey ?? null,
    p_new_category_label: params.newCategoryLabel ?? null,
  });
  if (error) return { roleKey: null, error: error.message };
  return { roleKey: data as string, error: null };
}

export async function removeCustomCrewRole(campaignId: string, roleKey: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("remove_custom_crew_role", { p_campaign_id: campaignId, p_role_key: roleKey });
  return { error: error?.message ?? null };
}
