import { supabase } from "../supabaseClient";

export interface ShootDay {
  id?: string;
  eventDate: string; // ISO yyyy-mm-dd — real date, not the old freeform "Mon 07/14" label
  hours: string;
  talentNote: string;
  description: string;
}

export async function fetchShootDays(campaignId: string): Promise<ShootDay[]> {
  const { data, error } = await supabase
    .from("shoot_days")
    .select("id, event_date, hours, talent_note, description")
    .eq("campaign_id", campaignId)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    id: r.id,
    eventDate: r.event_date ?? "",
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
      event_date: d.eventDate || null,
      hours: d.hours || null,
      talent_note: d.talentNote || null,
      description: d.description || null,
      sort_order: i,
    }))
  );
  return { error: error?.message ?? null };
}

// One-off insert used by the Schedule calendar's quick-add — the
// whole-list replace above would wipe every other shoot day on that
// campaign, which is fine for the Deliverables tab's single bulk-edit
// list but wrong for adding one date from a completely different screen.
export async function createShootDay(params: {
  campaignId: string; eventDate: string; description?: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("shoot_days").insert({
    campaign_id: params.campaignId,
    event_date: params.eventDate,
    description: params.description || null,
  });
  return { error: error?.message ?? null };
}
