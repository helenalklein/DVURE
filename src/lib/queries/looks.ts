import { supabase } from "../supabaseClient";

export type FittingStatus = "not_scheduled" | "scheduled" | "complete";

export const FITTING_STATUSES: { value: FittingStatus; label: string }[] = [
  { value: "not_scheduled", label: "Not Scheduled" },
  { value: "scheduled", label: "Scheduled" },
  { value: "complete", label: "Complete" },
];

// Real Runway looks — garments/accessories per numbered look, who's
// assigned to execute it (model, hair, makeup, dresser), fitting
// status, and lineup/show-sequence fields (0079: quick-change notes,
// music/lighting cues, backstage notes — same row as the garment data,
// a different lens on it for the Lineup tab). See 0075: this table
// existed since 0001 but was never wired past mock data.
export interface CampaignLook {
  id: string;
  campaignId: string;
  number: number;
  garments: string;
  shoes: string;
  jewelry: string;
  accessories: string;
  stylistNotes: string;
  dressingNotes: string;
  assignedModelId: string | null;
  assignedHairId: string | null;
  assignedMakeupId: string | null;
  assignedDresserId: string | null;
  fittingStatus: FittingStatus;
  quickChangeNote: string;
  musicCue: string;
  lightingCue: string;
  backstageNote: string;
}

const LOOK_SELECT = "id, campaign_id, look_number, garments, shoes, jewelry, accessories, stylist_notes, dressing_notes, assigned_model_id, assigned_hair_id, assigned_makeup_id, assigned_dresser_id, fitting_status, quick_change_note, music_cue, lighting_cue, backstage_note";

function mapLook(r: any): CampaignLook {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    number: r.look_number ?? 0,
    garments: r.garments ?? "",
    shoes: r.shoes ?? "",
    jewelry: r.jewelry ?? "",
    accessories: r.accessories ?? "",
    stylistNotes: r.stylist_notes ?? "",
    dressingNotes: r.dressing_notes ?? "",
    assignedModelId: r.assigned_model_id,
    assignedHairId: r.assigned_hair_id,
    assignedMakeupId: r.assigned_makeup_id,
    assignedDresserId: r.assigned_dresser_id,
    fittingStatus: r.fitting_status ?? "not_scheduled",
    quickChangeNote: r.quick_change_note ?? "",
    musicCue: r.music_cue ?? "",
    lightingCue: r.lighting_cue ?? "",
    backstageNote: r.backstage_note ?? "",
  };
}

export async function fetchLooks(campaignId: string): Promise<CampaignLook[]> {
  const { data, error } = await supabase
    .from("looks")
    .select(LOOK_SELECT)
    .eq("campaign_id", campaignId)
    .order("look_number", { ascending: true });
  if (error || !data) return [];
  return (data as any[]).map(mapLook);
}

export async function createLook(campaignId: string, number: number): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("looks")
    .insert({ campaign_id: campaignId, look_number: number })
    .select("id")
    .single();
  if (error || !data) return { id: null, error: error?.message ?? "Failed to create look" };
  return { id: data.id, error: null };
}

export async function updateLook(id: string, patch: Partial<Omit<CampaignLook, "id" | "campaignId" | "number">>): Promise<{ error: string | null }> {
  const row: Record<string, unknown> = {};
  if (patch.garments !== undefined) row.garments = patch.garments;
  if (patch.shoes !== undefined) row.shoes = patch.shoes;
  if (patch.jewelry !== undefined) row.jewelry = patch.jewelry;
  if (patch.accessories !== undefined) row.accessories = patch.accessories;
  if (patch.stylistNotes !== undefined) row.stylist_notes = patch.stylistNotes;
  if (patch.dressingNotes !== undefined) row.dressing_notes = patch.dressingNotes;
  if (patch.assignedModelId !== undefined) row.assigned_model_id = patch.assignedModelId;
  if (patch.assignedHairId !== undefined) row.assigned_hair_id = patch.assignedHairId;
  if (patch.assignedMakeupId !== undefined) row.assigned_makeup_id = patch.assignedMakeupId;
  if (patch.assignedDresserId !== undefined) row.assigned_dresser_id = patch.assignedDresserId;
  if (patch.fittingStatus !== undefined) row.fitting_status = patch.fittingStatus;
  if (patch.quickChangeNote !== undefined) row.quick_change_note = patch.quickChangeNote;
  if (patch.musicCue !== undefined) row.music_cue = patch.musicCue;
  if (patch.lightingCue !== undefined) row.lighting_cue = patch.lightingCue;
  if (patch.backstageNote !== undefined) row.backstage_note = patch.backstageNote;
  const { error } = await supabase.from("looks").update(row).eq("id", id);
  return { error: error?.message ?? null };
}

// Reordering the walk sequence is a renumber, not a separate "order"
// column — look_number already IS the walk/show order everywhere else
// (Looks tab sort, print, etc.), so Lineup reordering just swaps two
// looks' numbers rather than introducing a second ordering concept.
export async function swapLookOrder(a: { id: string; number: number }, b: { id: string; number: number }): Promise<{ error: string | null }> {
  const { error: e1 } = await supabase.from("looks").update({ look_number: b.number }).eq("id", a.id);
  if (e1) return { error: e1.message };
  const { error: e2 } = await supabase.from("looks").update({ look_number: a.number }).eq("id", b.id);
  return { error: e2?.message ?? null };
}

export async function deleteLook(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("looks").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export interface LookableModel {
  id: string;
  name: string;
}

// Only models actually cast for this show, not the whole platform —
// selected or booked submissions, same bar the rest of the app uses for
// "this model is really on the project."
export async function fetchLookableModels(campaignId: string): Promise<LookableModel[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select("stage, model_profiles(id, full_name)")
    .eq("campaign_id", campaignId)
    .in("stage", ["selected", "booked"]);
  if (error || !data) return [];
  return (data as any[])
    .filter(r => r.model_profiles)
    .map(r => ({ id: r.model_profiles.id, name: r.model_profiles.full_name }));
}
