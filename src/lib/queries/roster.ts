import { supabase } from "../supabaseClient";
import type { RosterModel, RepresentationExclusivity } from "../../app/shared/types";

function parseRate(rate: string): number | null {
  const n = parseFloat(rate.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// status defaults to "active" (the working roster) — pass "inactive" for
// the Archived view. Same query either way; only the filter changes, so
// archiving via end_representation_relationship (which flips this same
// status column) moves a model between the two views without a separate
// archived-models table or a soft-delete flag of its own.
export async function fetchAgencyRoster(agencyOrgId: string, agencyName: string, status: "active" | "inactive" = "active"): Promise<RosterModel[]> {
  const { data, error } = await supabase
    .from("agency_model_relationships")
    .select(`
      id, relationship_type, is_mother_agency, territories, exclusivity,
      effective_start_date, effective_end_date,
      model_id, model_profiles(id, full_name, email, location, default_day_rate, height, experience, profile_id, date_of_birth, guardian_name, guardian_email, guardian_relationship)
    `)
    .eq("agency_org_id", agencyOrgId)
    .eq("status", status);

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
        relationshipId: r.id as string,
        relationshipType: r.relationship_type as string,
        isMotherAgency: r.is_mother_agency as boolean,
        territories: (r.territories ?? []) as string[],
        exclusivity: r.exclusivity as RepresentationExclusivity,
        effectiveStartDate: r.effective_start_date as string,
        effectiveEndDate: (r.effective_end_date as string | null) ?? null,
        dateOfBirth: (m.date_of_birth as string | null) ?? null,
        guardianName: (m.guardian_name as string | null) ?? null,
        guardianEmail: (m.guardian_email as string | null) ?? null,
        guardianRelationship: (m.guardian_relationship as string | null) ?? null,
      };
    });
}

export interface DuplicateCheckResult {
  matchConfidence: "high" | "low" | null;
  existingModelId: string | null;
}

// Composite identity-signal check (see check_possible_model_duplicate,
// 0027) — deliberately not restricted to agencies (the RPC itself has no
// role check), so this same client wrapper is reusable by a future
// independent-model self-signup flow without changes.
export async function checkPossibleModelDuplicate(input: {
  fullName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string; // ISO date (YYYY-MM-DD)
  location?: string;
}): Promise<DuplicateCheckResult> {
  const { data, error } = await supabase.rpc("check_possible_model_duplicate", {
    p_full_name: input.fullName,
    p_email: input.email || null,
    p_phone: input.phone || null,
    p_date_of_birth: input.dateOfBirth || null,
    p_location: input.location || null,
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) return { matchConfidence: null, existingModelId: null };
  return {
    matchConfidence: (row.match_confidence as "high" | "low" | null) ?? null,
    existingModelId: (row.existing_model_id as string | null) ?? null,
  };
}

export interface RelationshipTerms {
  representationType: string;
  isMotherAgency: boolean;
  territories: string[];
  exclusivity: RepresentationExclusivity;
  effectiveStartDate: string;
  effectiveEndDate?: string;
  // Task 34's real money split — deliberately simple for the pilot
  // (0038): commissionPct is this relationship's own cut (0-1), null
  // falls back to the platform default. feeEntitlement "always" means
  // this agency is paid on every booking of this model regardless of
  // who actually books it (the real "mother agency" case — a model can
  // have more than one); "when_booking" (the default) means paid only
  // when this specific agency is the one who booked.
  commissionPct?: number | null;
  feeEntitlement?: "always" | "when_booking";
}

export interface RelationshipResult {
  relationshipId: string | null;
  overlapWarning: string | null;
  error: string | null;
}

// The "brand-new person" path — creates model_profiles + the first
// relationship in one transaction (add_new_model_to_roster, 0027).
export async function addNewModelToRoster(
  input: {
    name: string; email: string; location: string; rate: string; height: string; exp: string;
    dateOfBirth?: string; phone?: string;
  },
  terms: RelationshipTerms
): Promise<{ modelId: string | null; relationshipId: string | null; overlapWarning: string | null; duplicateConfidence: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("add_new_model_to_roster", {
    p_full_name: input.name,
    p_email: input.email,
    p_location: input.location,
    p_default_day_rate: parseRate(input.rate),
    p_height: input.height,
    p_experience: input.exp,
    p_date_of_birth: input.dateOfBirth || null,
    p_phone: input.phone || null,
    p_representation_type: terms.representationType,
    p_is_mother_agency: terms.isMotherAgency,
    p_territories: terms.territories,
    p_exclusivity: terms.exclusivity,
    p_effective_start_date: terms.effectiveStartDate,
    p_effective_end_date: terms.effectiveEndDate || null,
    p_commission_pct: terms.commissionPct ?? null,
    p_fee_entitlement: terms.feeEntitlement ?? "when_booking",
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) {
    return { modelId: null, relationshipId: null, overlapWarning: null, duplicateConfidence: null, error: error?.message ?? "Couldn't add model." };
  }
  return {
    modelId: row.model_id as string,
    relationshipId: row.relationship_id as string,
    overlapWarning: (row.overlap_warning as string | null) ?? null,
    duplicateConfidence: (row.duplicate_confidence as string | null) ?? null,
    error: null,
  };
}

// The "link to an existing profile" path — a duplicate check came back
// 'high' confidence, the agency confirmed it's the same person, so this
// creates only the relationship row against the existing model_id
// (create_representation_relationship, 0027) rather than a new profile.
export async function linkModelToExistingRoster(existingModelId: string, terms: RelationshipTerms): Promise<RelationshipResult> {
  const { data, error } = await supabase.rpc("create_representation_relationship", {
    p_model_id: existingModelId,
    p_representation_type: terms.representationType,
    p_is_mother_agency: terms.isMotherAgency,
    p_territories: terms.territories,
    p_exclusivity: terms.exclusivity,
    p_effective_start_date: terms.effectiveStartDate,
    p_effective_end_date: terms.effectiveEndDate || null,
    p_commission_pct: terms.commissionPct ?? null,
    p_fee_entitlement: terms.feeEntitlement ?? "when_booking",
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) return { relationshipId: null, overlapWarning: null, error: error?.message ?? "Couldn't create representation relationship." };
  return { relationshipId: row.relationship_id as string, overlapWarning: (row.overlap_warning as string | null) ?? null, error: null };
}

export async function endRepresentationRelationship(relationshipId: string, effectiveEndDate?: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("end_representation_relationship", {
    p_relationship_id: relationshipId,
    p_effective_end_date: effectiveEndDate || new Date().toISOString().slice(0, 10),
  });
  return { error: error?.message ?? null };
}

export type ModelSex = "male" | "female" | "non_binary" | "other";

// Separate from add_new_model_to_roster/create_representation_relationship
// on purpose (0086) — called right after either one, once the model
// definitely exists, rather than folded into either untracked legacy
// RPC's own signature.
export async function setModelIntakeDetails(modelId: string, details: {
  sex?: ModelSex; guardianName?: string; guardianEmail?: string; guardianRelationship?: string;
  // Purely informational for a minor — the guardian stays the account
  // holder and the only one who can sign; this just lets a 16/17 year
  // old also be reachable directly (e.g. day-of, on set).
  secondaryEmail?: string; secondaryPhone?: string;
  // Lets an agency fix a wrong DOB after intake (0091) — separate from
  // add_new_model_to_roster's own p_date_of_birth, which only ever runs
  // once, at creation.
  dateOfBirth?: string;
  // The "mark as adult" action — an explicit wipe, not just omitting the
  // guardian fields above (coalesce(nullif(x,''), old) can update them
  // but can never clear one back to null on its own).
  clearGuardianInfo?: boolean;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_model_intake_details", {
    p_model_id: modelId,
    p_sex: details.sex ?? null,
    p_guardian_name: details.guardianName || null,
    p_guardian_email: details.guardianEmail || null,
    p_guardian_relationship: details.guardianRelationship || null,
    p_secondary_email: details.secondaryEmail || null,
    p_secondary_phone: details.secondaryPhone || null,
    p_date_of_birth: details.dateOfBirth || null,
    p_clear_guardian_info: details.clearGuardianInfo ?? false,
  });
  return { error: error?.message ?? null };
}

// Fire-and-forget — called once from the roster fetch path (AgencyApp),
// never awaited/blocking. No scheduled-job infra exists in this repo
// (see notify_adult_transitions', 0091, own comment), so this is what
// stands in for "check on the 18th birthday": whenever an agency staffer
// next opens their roster, any model who's since turned 18 with
// guardian info still on file gets one real notification, deduped
// server-side so it only ever fires once per model.
export async function notifyAdultTransitions(): Promise<void> {
  await supabase.rpc("notify_adult_transitions");
}

// The one field on a model's profile the model sets for themselves.
export async function updateMyPronouns(pronouns: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("update_my_pronouns", { p_pronouns: pronouns });
  return { error: error?.message ?? null };
}
