import { supabase } from "../supabaseClient";

export interface ScheduleEvent {
  id: string;
  campaignRealId: string;
  kind: "shoot" | "casting";
  eventDate: string; // ISO yyyy-mm-dd
  title: string;
}

// Pulls both event kinds across every real campaign at once — the
// Schedule calendar shows the whole brand's picture, not one campaign at
// a time, so this fans out to shoot_days + castings together rather than
// making the caller stitch two separate per-campaign fetches.
export async function fetchScheduleEvents(campaignRealIds: string[]): Promise<ScheduleEvent[]> {
  if (campaignRealIds.length === 0) return [];

  const [{ data: shoots }, { data: castingRows }] = await Promise.all([
    supabase.from("shoot_days").select("id, campaign_id, event_date, description, talent_note")
      .in("campaign_id", campaignRealIds).not("event_date", "is", null),
    supabase.from("castings").select("id, campaign_id, event_date, title")
      .in("campaign_id", campaignRealIds),
  ]);

  const events: ScheduleEvent[] = [];
  for (const s of (shoots ?? []) as any[]) {
    events.push({
      id: s.id, campaignRealId: s.campaign_id, kind: "shoot", eventDate: s.event_date,
      title: s.description || s.talent_note || "Shoot day",
    });
  }
  for (const c of (castingRows ?? []) as any[]) {
    events.push({
      id: c.id, campaignRealId: c.campaign_id, kind: "casting", eventDate: c.event_date,
      title: c.title || "Casting",
    });
  }
  return events;
}
