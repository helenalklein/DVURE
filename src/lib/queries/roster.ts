import { supabase } from "../supabaseClient";
import type { RosterModel } from "../../app/shared/types";

function parseRate(rate: string): number | null {
  const n = parseFloat(rate.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function fetchAgencyRoster(agencyOrgId: string, agencyName: string): Promise<RosterModel[]> {
  const { data, error } = await supabase
    .from("agency_model_relationships")
    .select("model_id, model_profiles(id, full_name, email, location, default_day_rate, height, experience, profile_id)")
    .eq("agency_org_id", agencyOrgId)
    .eq("status", "active");

  if (error || !data) return [];

  return (data as any[])
    .filter(r => r.model_profiles)
    .map(r => {
      const m = r.model_profiles;
      return {
        id: m.id as string,
        name: m.full_name,
        email: m.email ?? "",
        agency: agencyName,
        location: m.location ?? "",
        rate: m.default_day_rate != null ? `$${m.default_day_rate}/day` : "",
        height: m.height ?? "",
        exp: m.experience ?? "",
        hasLogin: m.profile_id != null,
      };
    });
}

// The agency directly adding a model to their own roster is the mother
// relationship — a boutique link (a second agency also representing an
// already-mothered model) is a separate, not-yet-built flow. profile_id
// stays null: no real auth.users row exists until the model accepts an
// invite (a separate feature), same as 0003_seed.sql's Zara pattern.
export async function insertRosterModel(
  agencyOrgId: string,
  agencyName: string,
  input: { name: string; email: string; location: string; rate: string; height: string; exp: string }
): Promise<{ model: RosterModel | null; error: string | null }> {
  const { data: model, error: modelError } = await supabase
    .from("model_profiles")
    .insert({
      full_name: input.name,
      email: input.email,
      location: input.location,
      default_day_rate: parseRate(input.rate),
      height: input.height,
      experience: input.exp,
    })
    .select("id")
    .single();

  if (modelError || !model) return { model: null, error: modelError?.message ?? "Couldn't add model." };

  const { error: relError } = await supabase
    .from("agency_model_relationships")
    .insert({ model_id: model.id, agency_org_id: agencyOrgId, relationship_type: "mother" });

  if (relError) return { model: null, error: relError.message };

  return {
    model: {
      id: model.id as string,
      name: input.name,
      email: input.email,
      agency: agencyName,
      location: input.location,
      rate: input.rate,
      height: input.height,
      exp: input.exp,
      hasLogin: false,
    },
    error: null,
  };
}
