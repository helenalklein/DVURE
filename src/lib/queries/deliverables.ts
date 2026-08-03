import { supabase } from "../supabaseClient";

export interface ShootDay {
  id?: string;
  dateLabel: string;
  hours: string;
  talentNote: string;
  description: string;
}

export async function fetchShootDays(campaignId: string): Promise<ShootDay[]> {
  const { data, error } = await supabase
    .from("shoot_days")
    .select("id, date_label, hours, talent_note, description")
    .eq("campaign_id", campaignId)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    id: r.id,
    dateLabel: r.date_label ?? "",
    hours: r.hours ?? "",
    talentNote: r.talent_note ?? "",
    description: r.description ?? "",
  }));
}

// Whole-list replace on save, matching the single "Save Deliverables"
// button the UI already has — simpler and safer than diffing individual
// row edits/reorders/deletes against whatever was there before.
export async function saveShootDays(campaignId: string, days: ShootDay[]): Promise<{ error: string | null }> {
  const { error: delErr } = await supabase.from("shoot_days").delete().eq("campaign_id", campaignId);
  if (delErr) return { error: delErr.message };
  if (days.length === 0) return { error: null };
  const { error } = await supabase.from("shoot_days").insert(
    days.map((d, i) => ({
      campaign_id: campaignId,
      date_label: d.dateLabel || null,
      hours: d.hours || null,
      talent_note: d.talentNote || null,
      description: d.description || null,
      sort_order: i,
    }))
  );
  return { error: error?.message ?? null };
}
