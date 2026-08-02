import { supabase } from "../supabaseClient";

export interface CallSheetAssignment {
  roleKey: string;
  crewPayeeId: string;
  fullName: string;
  discipline: string | null;
}

export interface CrewDirectoryEntry {
  id: string;
  fullName: string;
  email: string;
  discipline: string | null;
}

export async function fetchCallSheetSlots(campaignId: string): Promise<CallSheetAssignment[]> {
  const { data, error } = await supabase
    .from("campaign_crew_slots")
    .select("role_key, crew_payee_id, crew_payees(full_name, discipline)")
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
    }));
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

export async function inviteCrewToCallSheet(
  campaignId: string, roleKey: string, fullName: string, email: string, discipline: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("invite_crew_to_call_sheet", {
    p_campaign_id: campaignId, p_role_key: roleKey, p_full_name: fullName, p_email: email, p_discipline: discipline,
  });
  return { error: error?.message ?? null };
}
