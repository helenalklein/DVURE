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
    .select("access_level, title, organizations(id, name, org_type, verification_status, subscription_status, trial_ends_at, logo_url, payment_locked, self_described_services, founding_member)")
    .eq("profile_id", profileId)
    .maybeSingle();
}

export async function updateOrgLogo(orgId: string, dataUri: string | null): Promise<{ error: string | null }> {
  const { error } = await supabase.from("organizations").update({ logo_url: dataUri }).eq("id", orgId);
  return { error: error?.message ?? null };
}

export async function fetchModelProfile(profileId: string) {
  return supabase
    .from("model_profiles")
    .select("id, full_name, location, photo_url, height, bust, waist, dress, default_day_rate, email")
    .eq("profile_id", profileId)
    .maybeSingle();
}

export async function fetchCrewProfile(profileId: string) {
  return supabase
    .from("crew_payees")
    .select("id, full_name, discipline")
    .eq("profile_id", profileId)
    .maybeSingle();
}

export async function fetchModelAgencies(modelId: string) {
  return supabase
    .from("agency_model_relationships")
    .select("relationship_type, is_mother_agency, organizations(id, name)")
    .eq("model_id", modelId)
    .eq("status", "active");
}
