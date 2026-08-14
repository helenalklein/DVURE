import { supabase } from "../supabaseClient";
import { logAuditEvent } from "../audit";
import type { Talent, SubmissionStage } from "../../app/shared/types";

// Talent.id is `number` throughout the app (mock ids 1-14) — rather than
// changing that type everywhere (it cascades into CAMPAIGN_AGENCIES,
// CASTING_ENTRIES, LOOKS, all still mock/out of scope this pass), real
// submissions get synthetic sequential ids starting well above the mock
// range, with a reverse map back to the real uuids for writes.
const SHIM_ID_BASE = 100_000;

export interface SubmissionShimEntry { submissionId: string; modelId: string; agencyOrgId: string; }
export type SubmissionShim = Map<number, SubmissionShimEntry>;

// One entry per agency that submitted a given (grouped) Talent card —
// used by the Moodboard drawer's per-agency Approve/Reject actions when
// duplicateFlag is true. Keyed by the same synthetic Talent.id as shim.
export interface DuplicateSubmissionEntry { submissionId: string; agencyOrgId: string; agencyName: string; stage: SubmissionStage; }
export type DuplicatesShim = Map<number, DuplicateSubmissionEntry[]>;

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
  photo_url: string | null;
  email: string | null;
  phone: string | null;
}

function formatRate(n: number | null): string {
  return n != null ? `$${n}/day` : "";
}

// booked > approved > submitted > rejected — when the same model has
// been submitted by more than one agency, the grouped card shows/uses
// whichever agency's progress is furthest along, so the board never
// regresses visibility as agencies act independently in the drawer.
const STAGE_RANK: Record<SubmissionStage, number> = { booked: 3, approved: 2, submitted: 1, rejected: 0 };

export async function fetchCampaignSubmissions(campaignId: string): Promise<{ talent: Talent[]; shim: SubmissionShim; duplicates: DuplicatesShim }> {
  const { data: subs, error } = await supabase
    .from("submissions")
    .select(`
      id, model_id, stage, availability, rate_quoted, notes, brand_score,
      submitting_agency_id,
      submitting_agency:organizations!submissions_submitting_agency_id_fkey(name),
      submitted_by:profiles!submissions_submitted_by_profile_id_fkey(full_name, email),
      model_profiles(id, full_name, location, default_day_rate, height, bust, waist, dress, experience, photo_url, email, phone)
    `)
    .eq("campaign_id", campaignId);

  if (error || !subs || subs.length === 0) return { talent: [], shim: new Map(), duplicates: new Map() };

  const modelIds = subs.map((s: any) => s.model_id);
  const { data: rels } = await supabase
    .from("agency_model_relationships")
    .select("model_id, is_mother_agency, organizations(name)")
    .in("model_id", modelIds)
    .eq("status", "active");

  const motherByModel = new Map<string, string>();
  const boutiqueByModel = new Map<string, string[]>();
  for (const r of (rels ?? []) as any[]) {
    const orgName = r.organizations?.name ?? "";
    if (r.is_mother_agency) motherByModel.set(r.model_id, orgName);
    else boutiqueByModel.set(r.model_id, [...(boutiqueByModel.get(r.model_id) ?? []), orgName]);
  }

  // Group submission rows by model_id — the brand sees one card per
  // model even when multiple agencies have each submitted it.
  const groups = new Map<string, any[]>();
  for (const s of subs as any[]) {
    groups.set(s.model_id, [...(groups.get(s.model_id) ?? []), s]);
  }

  const shim: SubmissionShim = new Map();
  const duplicates: DuplicatesShim = new Map();
  const talent: Talent[] = [...groups.entries()].map(([modelId, group], i) => {
    const id = SHIM_ID_BASE + i;
    // Canonical row: most-advanced stage wins; ties broken by earliest
    // created_at isn't tracked in this select, so first-in-array (stable
    // query order) is the tiebreak, which is fine — ties only affect
    // which row's notes/rate/score surface on the collapsed card, never
    // which agencies are recorded as having submitted.
    const canonical = group.reduce((best, s) => (STAGE_RANK[s.stage as SubmissionStage] > STAGE_RANK[best.stage as SubmissionStage] ? s : best), group[0]);
    shim.set(id, { submissionId: canonical.id, modelId, agencyOrgId: canonical.submitting_agency_id });

    if (group.length > 1) {
      duplicates.set(id, group.map((s: any) => ({
        submissionId: s.id as string,
        agencyOrgId: s.submitting_agency_id as string,
        agencyName: s.submitting_agency?.name ?? "",
        stage: s.stage as SubmissionStage,
      })));
    }

    const m: ModelRow = canonical.model_profiles;
    return {
      id,
      modelId,
      name: m?.full_name ?? "Unknown",
      photoUrl: m?.photo_url ?? "",
      modelEmail: m?.email ?? "",
      modelPhone: m?.phone ?? "",
      agency: canonical.submitting_agency?.name ?? "",
      submittedByName: canonical.submitted_by?.full_name ?? "",
      submittedByEmail: canonical.submitted_by?.email ?? "",
      motherAgency: motherByModel.get(modelId) ?? "",
      boutiqueAgencies: boutiqueByModel.get(modelId) ?? [],
      location: m?.location ?? "",
      rate: canonical.rate_quoted != null ? formatRate(canonical.rate_quoted) : formatRate(m?.default_day_rate ?? null),
      stage: canonical.stage as SubmissionStage,
      avail: canonical.availability,
      note: canonical.notes ?? "",
      height: m?.height ?? "",
      bust: m?.bust ?? "",
      waist: m?.waist ?? "",
      dress: m?.dress ?? "",
      exp: m?.experience ?? "",
      score: canonical.brand_score ?? 0,
      duplicateFlag: group.length > 1,
      submittedByAgencies: group.map((s: any) => s.submitting_agency?.name ?? "").filter(Boolean),
    };
  });

  return { talent, shim, duplicates };
}

export async function updateSubmissionStage(
  submissionId: string,
  stage: SubmissionStage,
  opts?: { reviewedByProfileId?: string; declineReason?: string }
) {
  // Fetched before the write so the audit entry can carry a real
  // previous_value — this table has no security-definer RPC of its own
  // yet, so logAuditEvent() here is the client-side (skippable, see
  // src/lib/audit.ts) half of the audit system, not the guaranteed
  // transactional kind complete_org_signup/record_payment_attempt get.
  const { data: prior } = await supabase.from("submissions").select("stage, campaign_id").eq("id", submissionId).maybeSingle();

  const patch: Record<string, unknown> = { stage, updated_at: new Date().toISOString() };
  if (opts?.reviewedByProfileId) {
    patch.reviewed_by_profile_id = opts.reviewedByProfileId;
    patch.reviewed_at = new Date().toISOString();
  }
  if (opts?.declineReason) patch.decline_reason = opts.declineReason;
  const { error } = await supabase.from("submissions").update(patch).eq("id", submissionId);

  if (!error) {
    logAuditEvent({
      action: "submission.stage_changed",
      objectType: "submission",
      objectId: submissionId,
      campaignId: prior?.campaign_id,
      previousValue: prior ? { stage: prior.stage } : undefined,
      newValue: { stage, declineReason: opts?.declineReason },
    });
  }

  return { error };
}

// Thin wrapper over the submit_talent RPC (0029) — the RPC itself
// handles the upsert-on-same-agency-resubmit and duplicate/overlap
// flagging that used to be a hard unique-constraint violation here.
export async function insertSubmission(params: {
  campaignId: string;
  modelId: string;
  notes?: string;
}): Promise<{ submissionId: string | null; duplicateSubmission: boolean; overlapWarning: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("submit_talent", {
    p_campaign_id: params.campaignId,
    p_model_id: params.modelId,
    p_notes: params.notes ?? null,
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) {
    return { submissionId: null, duplicateSubmission: false, overlapWarning: null, error: error?.message ?? "Couldn't submit this model — try again." };
  }
  return {
    submissionId: row.submission_id as string,
    duplicateSubmission: row.duplicate_submission as boolean,
    overlapWarning: (row.overlap_warning as string | null) ?? null,
    error: null,
  };
}
