import { supabase } from "../supabaseClient";

export interface BrandCrewMember {
  id: string;
  fullName: string;
  email: string;
  discipline: string | null;
  hasLogin: boolean;
  roles: { campaignName: string; roleKey: string; isDepartmentLead: boolean }[];
}

// crew_payees_select_via_brand_history (0026) already scopes this to only
// crew who've actually worked one of this brand's campaigns — no need to
// re-filter client-side, the join below is just how we walk to them.
export async function fetchBrandCrew(brandOrgId: string): Promise<BrandCrewMember[]> {
  const { data, error } = await supabase
    .from("campaign_crew_slots")
    .select(`
      role_key, is_department_lead,
      campaigns!inner(name, brand_org_id),
      crew_payees!inner(id, full_name, email, discipline, profile_id)
    `)
    .eq("campaigns.brand_org_id", brandOrgId);

  if (error || !data) return [];

  const byId = new Map<string, BrandCrewMember>();
  for (const row of data as any[]) {
    const cp = row.crew_payees;
    if (!cp) continue;
    const existing: BrandCrewMember = byId.get(cp.id) ?? {
      id: cp.id,
      fullName: cp.full_name,
      email: cp.email,
      discipline: cp.discipline,
      hasLogin: cp.profile_id != null,
      roles: [],
    };
    existing.roles.push({
      campaignName: row.campaigns?.name ?? "",
      roleKey: row.role_key,
      isDepartmentLead: row.is_department_lead,
    });
    byId.set(cp.id, existing);
  }
  return [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
}
