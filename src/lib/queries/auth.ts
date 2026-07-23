// Identity-resolution reads used only by AuthProvider (src/app/shared/auth.tsx)
// right after a session appears — who is this person, and (depending on
// role) which org or model_profiles row do they belong to.
import { supabase } from "../supabaseClient";

export async function fetchProfile(userId: string) {
  return supabase
    .from("profiles")
    .select("id, role, full_name, email, phone")
    .eq("id", userId)
    .maybeSingle();
}

export async function fetchOrgMembership(profileId: string) {
  return supabase
    .from("org_memberships")
    .select("access_level, title, organizations(id, name, org_type)")
    .eq("profile_id", profileId)
    .maybeSingle();
}

export async function fetchModelProfile(profileId: string) {
  return supabase
    .from("model_profiles")
    .select("id, full_name, location")
    .eq("profile_id", profileId)
    .maybeSingle();
}

export async function fetchModelAgencies(modelId: string) {
  return supabase
    .from("agency_model_relationships")
    .select("relationship_type, organizations(id, name)")
    .eq("model_id", modelId)
    .eq("status", "active");
}
