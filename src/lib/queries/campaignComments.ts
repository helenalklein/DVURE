import { supabase } from "../supabaseClient";

// The Model Board's collapsible internal comment panel — brand-team-only
// running log, separate from the (currently mock-only) Messaging tab.
export interface CampaignComment {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export async function fetchCampaignComments(campaignId: string): Promise<CampaignComment[]> {
  const { data, error } = await supabase
    .from("campaign_comments")
    .select("id, text, created_at, profiles(full_name)")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as any[]).map(r => ({
    id: r.id,
    authorName: r.profiles?.full_name ?? "Someone",
    text: r.text,
    createdAt: r.created_at,
  }));
}

export async function postCampaignComment(campaignId: string, authorProfileId: string, text: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("campaign_comments").insert({
    campaign_id: campaignId,
    author_profile_id: authorProfileId,
    text,
  });
  return { error: error?.message ?? null };
}
