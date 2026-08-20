import { supabase } from "../supabaseClient";
import { logAuditEvent } from "../audit";
import { assignStockPhotos } from "../../app/shared/mockData";
import type { Talent, SubmissionStage } from "../../app/shared/types";

// Talent.id is `number` throughout the app (mock ids 1-14) — rather than
// changing that type everywhere (it cascades into CAMPAIGN_AGENCIES,
// still mock/out of scope this pass), real submissions get synthetic
// sequential ids starting well above the mock range, with a reverse map
// back to the real uuids for writes. Looks now queries model_profiles
// directly for its own picker (fetchLookableModels), sidestepping this
// shim entirely.
const SHIM_ID_BASE = 100_000;

export interface SubmissionShimEntry { submissionId: string; modelId: string; agencyOrgId: string; }
export type SubmissionShim = Map<number, SubmissionShimEntry>;

// One entry per agency that submitted a given (grouped) Talent card.
// submissions no longer has a unique(campaign_id, model_id) constraint
// — a second agency submitting the same model to the same campaign now
// succeeds instead of erroring (submit_talent, which replaced the old
// raw insert). The brand still sees one card per model; this is what
// that collapsing is built on.
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
  sex: string | null;
  date_of_birth: string | null;
}

function formatRate(n: number | null): string {
  return n != null ? `$${n}/day` : "";
}

// booked > selected > shortlisted > submitted > candidate, with
// declined/released ranked below everything real (a decline from one
// agency must never outrank a live submission from another) — when the
// same model has been submitted by more than one agency, the grouped
// card shows whichever agency's progress is furthest along, so the
// board never regresses visibility as agencies act independently.
const STAGE_RANK: Record<SubmissionStage, number> = {
  booked: 6, selected: 5, shortlisted: 4, submitted: 3, candidate: 2, released: 1, declined: 0,
};

export async function fetchCampaignSubmissions(campaignId: string): Promise<{ talent: Talent[]; shim: SubmissionShim; duplicates: DuplicatesShim }> {
  const { data: subs, error } = await supabase
    .from("submissions")
    .select(`
      id, model_id, stage, availability, rate_quoted, notes, brand_score, board_position,
      submitting_agency_id,
      submitting_agency:organizations!submissions_submitting_agency_id_fkey(name),
      submitted_by:profiles!submissions_submitted_by_profile_id_fkey(full_name, email),
      model_profiles(id, full_name, location, default_day_rate, height, bust, waist, dress, experience, photo_url, email, sex, date_of_birth)
    `)
    .eq("campaign_id", campaignId)
    // Without an explicit order, Postgres doesn't guarantee row order is
    // stable across queries — harmless for most rows, but the canonical-row
    // pick below (STAGE_RANK reduce, ties won by whichever row is first)
    // needs a stable order or a model with two same-stage submissions (one
    // per submitting agency) can flip which row is "canonical" from one
    // fetch to the next, silently changing which board_position shows.
    .order("created_at", { ascending: true });

  if (error || !subs || subs.length === 0) return { talent: [], shim: new Map(), duplicates: new Map() };

  const modelIds = subs.map((s: any) => s.model_id);
  // is_mother_agency (0038), not relationship_type — representation_type
  // is free text now (agencies describe the relationship however fits,
  // see AddModelModal), so a literal 'mother' string match no longer
  // reliably identifies the mother-agency relationship. A model can have
  // more than one non-mother (boutique) relationship at once, so that
  // side is a list, not a single name.
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

  // One assignment pass over every model on this board at once — the
  // only way to guarantee nobody in the same gender bucket repeats a
  // photo, which a per-model hash (the previous approach) couldn't do.
  const stockPhotos = assignStockPhotos([...groups.entries()].map(([modelId, group]) => {
    const row = group[0]?.model_profiles as ModelRow | undefined;
    return { modelId, dress: row?.dress, sex: row?.sex };
  }));

  const shim: SubmissionShim = new Map();
  const duplicates: DuplicatesShim = new Map();
  const talent: Talent[] = [...groups.entries()].map(([modelId, group], i) => {
    const id = SHIM_ID_BASE + i;
    // Canonical row: most-advanced stage wins (ties broken by query
    // order) — only affects which row's notes/rate/score surface on
    // the collapsed card, never which agencies are recorded as having
    // submitted.
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
      name: m?.full_name ?? "Unknown",
      photo: stockPhotos.get(modelId),
      sex: m?.sex ?? undefined,
      agency: canonical.submitting_agency?.name ?? "Independent",
      motherAgency: motherByModel.get(modelId) ?? "",
      boutiqueAgencies: boutiqueByModel.get(modelId) ?? [],
      submittedByName: canonical.submitted_by?.full_name ?? undefined,
      submittedByEmail: canonical.submitted_by?.email ?? undefined,
      modelEmail: m?.email ?? undefined,
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
      boardPosition: canonical.board_position ?? null,
      dateOfBirth: m?.date_of_birth ?? null,
      duplicateFlag: group.length > 1,
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
  // for stage transitions, so logAuditEvent() here is the client-side
  // (skippable, see src/lib/audit.ts) half of the audit system, not the
  // guaranteed transactional kind complete_org_signup/create_booking get.
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

// notes already existed on submissions (set once at submit time, read
// back into Talent.note) but had no update path — the card's sticky
// note needs one so staff can add or change it after the fact.
export async function updateSubmissionNotes(submissionId: string, notes: string) {
  const { error } = await supabase.from("submissions").update({ notes, updated_at: new Date().toISOString() }).eq("id", submissionId);
  return { error: error?.message ?? null };
}

// Drag-to-reorder within a column (0090) — a plain float, not an
// integer id, since dropping between two existing cards lands on the
// midpoint of their positions rather than needing to renumber the
// whole column on every move.
export async function updateSubmissionPosition(submissionId: string, boardPosition: number) {
  const { error } = await supabase.from("submissions").update({ board_position: boardPosition }).eq("id", submissionId);
  return { error: error?.message ?? null };
}

// Thin wrapper over the submit_talent RPC — replaces the old raw insert
// (which relied on a unique(campaign_id, model_id) constraint that no
// longer exists) with real server-side logic: submitting_agency_id and
// submitted_by_profile_id are derived from the caller's own session
// rather than trusted from the client, and the RPC itself detects and
// flags both a duplicate submission (another agency already submitted
// this model here) and a territory-matched representation overlap,
// rather than either silently succeeding or hard-erroring.
export async function insertSubmission(params: {
  campaignId: string;
  modelId: string;
  notes?: string;
}): Promise<{ submissionId: string | null; duplicateSubmission: boolean; overlapWarning: string | null; error: { code?: string; message: string } | null }> {
  const { data, error } = await supabase.rpc("submit_talent", {
    p_campaign_id: params.campaignId,
    p_model_id: params.modelId,
    p_notes: params.notes ?? null,
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) {
    return {
      submissionId: null,
      duplicateSubmission: false,
      overlapWarning: null,
      error: { code: (error as { code?: string })?.code, message: error?.message ?? "Couldn't submit this model — try again." },
    };
  }
  return {
    submissionId: row.submission_id as string,
    duplicateSubmission: row.duplicate_submission as boolean,
    overlapWarning: (row.overlap_warning as string | null) ?? null,
    error: null,
  };
}
