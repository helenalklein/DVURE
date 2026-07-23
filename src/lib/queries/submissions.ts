import { supabase } from "../supabaseClient";
import type { Talent, SubmissionStage } from "../../app/shared/types";

// Talent.id is `number` throughout the app (mock ids 1-14) — rather than
// changing that type everywhere (it cascades into CAMPAIGN_AGENCIES,
// CASTING_ENTRIES, LOOKS, all still mock/out of scope this pass), real
// submissions get synthetic sequential ids starting well above the mock
// range, with a reverse map back to the real uuids for writes.
const SHIM_ID_BASE = 100_000;

export interface SubmissionShimEntry { submissionId: string; modelId: string; }
export type SubmissionShim = Map<number, SubmissionShimEntry>;

interface ModelRow {
  id: string;
  full_name: string;
  location: string | null;
  default_day_rate: number | null;
  height: string | null;
  bust: string | null;
  waist: string | null;
  dress: string | null;
  experience: string | null;
}

function formatRate(n: number | null): string {
  return n != null ? `$${n}/day` : "";
}

export async function fetchCampaignSubmissions(campaignId: string): Promise<{ talent: Talent[]; shim: SubmissionShim }> {
  const { data: subs, error } = await supabase
    .from("submissions")
    .select(`
      id, model_id, stage, availability, rate_quoted, notes, brand_score,
      submitting_agency:organizations!submissions_submitting_agency_id_fkey(name),
      model_profiles(id, full_name, location, default_day_rate, height, bust, waist, dress, experience)
    `)
    .eq("campaign_id", campaignId);

  if (error || !subs || subs.length === 0) return { talent: [], shim: new Map() };

  const modelIds = subs.map((s: any) => s.model_id);
  const { data: rels } = await supabase
    .from("agency_model_relationships")
    .select("model_id, relationship_type, organizations(name)")
    .in("model_id", modelIds)
    .eq("status", "active");

  const motherByModel = new Map<string, string>();
  const boutiqueByModel = new Map<string, string>();
  for (const r of (rels ?? []) as any[]) {
    const orgName = r.organizations?.name ?? "";
    if (r.relationship_type === "mother") motherByModel.set(r.model_id, orgName);
    else if (!boutiqueByModel.has(r.model_id)) boutiqueByModel.set(r.model_id, orgName);
  }

  const shim: SubmissionShim = new Map();
  const talent: Talent[] = subs.map((s: any, i: number) => {
    const id = SHIM_ID_BASE + i;
    shim.set(id, { submissionId: s.id, modelId: s.model_id });
    const m: ModelRow = s.model_profiles;
    return {
      id,
      name: m?.full_name ?? "Unknown",
      agency: s.submitting_agency?.name ?? "",
      motherAgency: motherByModel.get(s.model_id) ?? "",
      boutiqueAgency: boutiqueByModel.get(s.model_id),
      location: m?.location ?? "",
      rate: s.rate_quoted != null ? formatRate(s.rate_quoted) : formatRate(m?.default_day_rate ?? null),
      stage: s.stage as SubmissionStage,
      avail: s.availability,
      note: s.notes ?? "",
      height: m?.height ?? "",
      bust: m?.bust ?? "",
      waist: m?.waist ?? "",
      dress: m?.dress ?? "",
      exp: m?.experience ?? "",
      score: s.brand_score ?? 0,
    };
  });

  return { talent, shim };
}

export async function updateSubmissionStage(
  submissionId: string,
  stage: SubmissionStage,
  opts?: { reviewedByProfileId?: string; declineReason?: string }
) {
  const patch: Record<string, unknown> = { stage, updated_at: new Date().toISOString() };
  if (opts?.reviewedByProfileId) {
    patch.reviewed_by_profile_id = opts.reviewedByProfileId;
    patch.reviewed_at = new Date().toISOString();
  }
  if (opts?.declineReason) patch.decline_reason = opts.declineReason;
  const { error } = await supabase.from("submissions").update(patch).eq("id", submissionId);
  return { error };
}

export async function insertSubmission(params: {
  campaignId: string;
  modelId: string;
  submittingAgencyId: string;
  submittedByProfileId: string;
  notes?: string;
}): Promise<{ error: { code?: string; message: string } | null }> {
  const { error } = await supabase.from("submissions").insert({
    campaign_id: params.campaignId,
    model_id: params.modelId,
    submitting_agency_id: params.submittingAgencyId,
    submitted_by_profile_id: params.submittedByProfileId,
    notes: params.notes ?? null,
  });
  if (error) return { error: { code: (error as { code?: string }).code, message: error.message } };
  return { error: null };
}
