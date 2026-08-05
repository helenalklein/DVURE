import { supabase } from "../supabaseClient";

export interface Casting {
  id: string;
  campaignId: string;
  eventDate: string; // ISO yyyy-mm-dd
  title: string;
  note: string;
}

export async function fetchCastings(campaignId: string): Promise<Casting[]> {
  const { data, error } = await supabase
    .from("castings")
    .select("id, campaign_id, event_date, title, note")
    .eq("campaign_id", campaignId)
    .order("event_date", { ascending: true });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    id: r.id,
    campaignId: r.campaign_id,
    eventDate: r.event_date,
    title: r.title ?? "",
    note: r.note ?? "",
  }));
}

export async function createCasting(params: {
  campaignId: string; eventDate: string; title?: string; note?: string; createdByProfileId?: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("castings").insert({
    campaign_id: params.campaignId,
    event_date: params.eventDate,
    title: params.title || null,
    note: params.note || null,
    created_by_profile_id: params.createdByProfileId || null,
  });
  return { error: error?.message ?? null };
}

export async function deleteCasting(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("castings").delete().eq("id", id);
  return { error: error?.message ?? null };
}
