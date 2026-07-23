import { supabase } from "../supabaseClient";
import type { CardComment } from "../../app/shared/types";
import type { SubmissionShim } from "./submissions";

const COMMENT_ID_BASE = 100_000;

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Brand-internal only (see submission_comments RLS in 0002_rls.sql) — an
// agency calling this simply gets zero rows back, not an error.
export async function fetchSubmissionComments(shim: SubmissionShim): Promise<CardComment[]> {
  const submissionIds = [...shim.values()].map(v => v.submissionId);
  if (submissionIds.length === 0) return [];

  const reverseBySubmission = new Map<string, number>();
  for (const [talentId, entry] of shim) reverseBySubmission.set(entry.submissionId, talentId);

  const { data, error } = await supabase
    .from("submission_comments")
    .select("id, submission_id, body, created_at, profiles(full_name), organizations(name)")
    .in("submission_id", submissionIds)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row: any, i: number) => ({
    id: COMMENT_ID_BASE + i,
    talentId: reverseBySubmission.get(row.submission_id) ?? -1,
    author: row.profiles?.full_name ?? "Unknown",
    org: row.organizations?.name ?? "",
    text: row.body,
    ts: formatTimestamp(row.created_at),
  }));
}

export async function insertSubmissionComment(submissionId: string, authorProfileId: string, authorOrgId: string, body: string) {
  const { error } = await supabase.from("submission_comments").insert({
    submission_id: submissionId,
    author_profile_id: authorProfileId,
    author_org_id: authorOrgId,
    body,
  });
  return { error };
}
