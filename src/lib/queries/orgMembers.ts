import { supabase } from "../supabaseClient";

export type AccessLevel = "administrator" | "enhanced" | "basic";

export interface OrgMember {
  membershipId: string;
  profileId: string;
  name: string;
  title: string | null;
  accessLevel: AccessLevel;
  status: "invited" | "active" | "suspended";
}

export async function fetchOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from("org_memberships")
    .select("id, profile_id, title, access_level, status, profiles(full_name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as any[]).map(m => ({
    membershipId: m.id,
    profileId: m.profile_id,
    name: m.profiles?.full_name ?? "Unknown",
    title: m.title,
    accessLevel: m.access_level,
    status: m.status,
  }));
}

export async function updateOrgMember(
  membershipId: string,
  patch: { title?: string; accessLevel?: AccessLevel }
): Promise<{ error: string | null }> {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.accessLevel !== undefined) update.access_level = patch.accessLevel;
  const { error } = await supabase.from("org_memberships").update(update).eq("id", membershipId);
  return { error: error?.message ?? null };
}
