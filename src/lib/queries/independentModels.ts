import { supabase } from "../supabaseClient";

export interface IndependentModel {
  id: string;
  fullName: string;
  location: string | null;
  defaultDayRate: number | null;
  photoUrl: string | null;
}

// model_profiles_select_independent (0049) exposes every is_independent
// row to any signed-in user — this is the brand's casting search against
// that, filtered client-side since the independent roster is small.
export async function searchIndependentModels(query: string): Promise<IndependentModel[]> {
  let q = supabase
    .from("model_profiles")
    .select("id, full_name, location, default_day_rate, photo_url")
    .eq("is_independent", true)
    .is("suspended_at", null)
    .order("full_name", { ascending: true })
    .limit(25);
  if (query.trim()) q = q.ilike("full_name", `%${query.trim()}%`);
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as any[]).map(r => ({
    id: r.id,
    fullName: r.full_name,
    location: r.location,
    defaultDayRate: r.default_day_rate,
    photoUrl: r.photo_url,
  }));
}

export async function submitIndependentModel(campaignId: string, modelId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("submit_independent_model", { p_campaign_id: campaignId, p_model_id: modelId });
  return { error: error?.message ?? null };
}
