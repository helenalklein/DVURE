import { supabase } from "../supabaseClient";
import type { SubmissionStage } from "../../app/shared/types";

export interface CrewSubmissionCard {
  modelId: string;
  name: string;
  photo?: string;
  location: string;
  rate: string;
  height: string;
  bust: string;
  waist: string;
  dress: string;
  exp: string;
  stage: SubmissionStage;
  notes: string;
  score: number;
  agencyName: string;
}

function formatRate(n: number | null): string {
  return n != null ? `$${n}/day` : "";
}

// Real crew read access to the Model Board — fetch_campaign_submissions_for_crew
// (0072) gates on my_call_sheet_role() itself, so this returns an empty
// list for anyone without real access rather than an error.
export async function fetchCampaignSubmissionsForCrew(campaignId: string): Promise<CrewSubmissionCard[]> {
  const { data, error } = await supabase.rpc("fetch_campaign_submissions_for_crew", { p_campaign_id: campaignId });
  if (error || !data) return [];
  return (data as any[]).map(r => ({
    modelId: r.model_id,
    name: r.full_name ?? "Unknown",
    photo: r.photo_url ?? undefined,
    location: r.location ?? "",
    rate: r.rate_quoted != null ? formatRate(r.rate_quoted) : formatRate(r.default_day_rate),
    height: r.height ?? "",
    bust: r.bust ?? "",
    waist: r.waist ?? "",
    dress: r.dress ?? "",
    exp: r.experience ?? "",
    stage: r.stage as SubmissionStage,
    notes: r.notes ?? "",
    score: r.brand_score ?? 0,
    agencyName: r.submitting_agency_name ?? "",
  }));
}
