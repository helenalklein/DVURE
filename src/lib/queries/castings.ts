import { supabase } from "../supabaseClient";

export interface Casting {
  id: string;
  campaignId: string;
  eventDate: string; // ISO yyyy-mm-dd
  title: string;
  note: string;
  locationName: string;
  address: string;
  castingTime: string;
}

export async function fetchCastings(campaignId: string): Promise<Casting[]> {
  const { data, error } = await supabase
    .from("castings")
    .select("id, campaign_id, event_date, title, note, location_name, address, casting_time")
    .eq("campaign_id", campaignId)
    .order("event_date", { ascending: true });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    id: r.id,
    campaignId: r.campaign_id,
    eventDate: r.event_date,
    title: r.title ?? "",
    note: r.note ?? "",
    locationName: r.location_name ?? "",
    address: r.address ?? "",
    castingTime: r.casting_time ?? "",
  }));
}

export async function createCasting(params: {
  campaignId: string; eventDate: string; title?: string; note?: string; createdByProfileId?: string;
  locationName?: string; address?: string; castingTime?: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("castings").insert({
    campaign_id: params.campaignId,
    event_date: params.eventDate,
    title: params.title || null,
    note: params.note || null,
    created_by_profile_id: params.createdByProfileId || null,
    location_name: params.locationName || null,
    address: params.address || null,
    casting_time: params.castingTime || null,
  });
  return { error: error?.message ?? null };
}

export async function updateCasting(id: string, params: {
  eventDate?: string; title?: string; note?: string; locationName?: string; address?: string; castingTime?: string;
}): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = {};
  if (params.eventDate !== undefined) patch.event_date = params.eventDate;
  if (params.title !== undefined) patch.title = params.title || null;
  if (params.note !== undefined) patch.note = params.note || null;
  if (params.locationName !== undefined) patch.location_name = params.locationName || null;
  if (params.address !== undefined) patch.address = params.address || null;
  if (params.castingTime !== undefined) patch.casting_time = params.castingTime || null;
  const { error } = await supabase.from("castings").update(patch).eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteCasting(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("castings").delete().eq("id", id);
  return { error: error?.message ?? null };
}
