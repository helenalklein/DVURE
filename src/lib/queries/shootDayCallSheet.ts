import { supabase } from "../supabaseClient";

// The real, industry-format call sheet — distinct from callSheet.ts
// (which is the staffing/role-assignment grid, labeled "Crew" in the UI
// now). One shoot day, one call sheet: location, logistics, a timed
// schedule, and — derived from the same staffing grid, not stored here —
// a department-grouped contact list.

export interface ShootDaySummary {
  id: string;
  campaignId: string;
  dateLabel: string | null;
  eventDate: string | null;
}

export interface CallSheetScheduleItem {
  time: string;
  label: string;
}

export interface CallSheetDetails {
  id: string;
  shootDayId: string;
  locationName: string;
  address: string;
  parkingNotes: string;
  nearestHospital: string;
  weather: string;
  crewCallTime: string;
  schedule: CallSheetScheduleItem[];
}

// shoot_days itself has a brand-only RLS policy (fine for its other
// consumer, Deliverables, but wrong here) — this goes through a
// security-definer RPC scoped to my_call_sheet_role() instead, so crew
// with real call sheet access can actually see which shoot days exist.
export async function fetchShootDays(campaignId: string): Promise<ShootDaySummary[]> {
  const { data, error } = await supabase.rpc("fetch_call_sheet_shoot_days", { p_campaign_id: campaignId });
  if (error || !data) return [];
  return (data as any[]).map(r => ({ id: r.id, campaignId: r.campaign_id, dateLabel: r.date_label, eventDate: r.event_date }));
}

// Returns null when no call sheet has been created for this shoot day
// yet — the UI shows an empty/"not filled in" state rather than an error.
export async function fetchCallSheet(shootDayId: string): Promise<CallSheetDetails | null> {
  const { data: sheet, error } = await supabase
    .from("call_sheets")
    .select("id, shoot_day_id, location_name, address, parking_notes, nearest_hospital, weather, crew_call_time")
    .eq("shoot_day_id", shootDayId)
    .maybeSingle();
  if (error || !sheet) return null;

  const { data: items } = await supabase
    .from("call_sheet_schedule_items")
    .select("item_time, label")
    .eq("call_sheet_id", sheet.id)
    .order("sort_order", { ascending: true });

  return {
    id: sheet.id,
    shootDayId: sheet.shoot_day_id,
    locationName: sheet.location_name ?? "",
    address: sheet.address ?? "",
    parkingNotes: sheet.parking_notes ?? "",
    nearestHospital: sheet.nearest_hospital ?? "",
    weather: sheet.weather ?? "",
    crewCallTime: sheet.crew_call_time ?? "",
    schedule: (items ?? []).map((i: any) => ({ time: i.item_time, label: i.label })),
  };
}

export async function saveCallSheetDetails(params: {
  shootDayId: string; locationName: string; address: string; parkingNotes: string;
  nearestHospital: string; weather: string; crewCallTime: string;
}): Promise<{ callSheetId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("upsert_call_sheet", {
    p_shoot_day_id: params.shootDayId,
    p_location_name: params.locationName || null,
    p_address: params.address || null,
    p_parking_notes: params.parkingNotes || null,
    p_nearest_hospital: params.nearestHospital || null,
    p_weather: params.weather || null,
    p_crew_call_time: params.crewCallTime || null,
  });
  if (error) return { callSheetId: null, error: error.message };
  return { callSheetId: data as string, error: null };
}

export async function saveCallSheetSchedule(callSheetId: string, items: CallSheetScheduleItem[]): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_call_sheet_schedule", {
    p_call_sheet_id: callSheetId,
    p_items: items,
  });
  return { error: error?.message ?? null };
}

// Contact list — derived from the same staffing grid the Crew tab
// shows, grouped by department so the printed sheet reads the way a
// real one does, not as a flat list. call_sheet_role_categories has no
// FK from campaign_crew_slots.role_key (it's a plain matching text
// column, not a declared relationship), so category lookup is a second,
// separate query merged client-side rather than a PostgREST embed.
// Phone isn't a crew_payees column at all — it only exists on profiles,
// reached through crew_payees.profile_id for crew who've actually
// signed in; someone invited but never logged in has no phone on file
// anywhere, which the UI shows as "Not set" rather than blank.
export interface CallSheetContact {
  category: string;
  roleKey: string;
  name: string;
  phone: string;
  email: string;
  isDepartmentLead: boolean;
}

export async function fetchCallSheetContacts(campaignId: string): Promise<CallSheetContact[]> {
  const [{ data: slots, error }, { data: categories }] = await Promise.all([
    supabase
      .from("campaign_crew_slots")
      .select(`role_key, is_department_lead, crew_payees(full_name, email, profiles(phone))`)
      .eq("campaign_id", campaignId)
      .not("crew_payee_id", "is", null),
    supabase.from("call_sheet_role_categories").select("role_key, category_key"),
  ]);
  if (error || !slots) return [];

  const categoryByRole = new Map((categories ?? []).map((c: any) => [c.role_key, c.category_key]));

  return (slots as any[])
    .filter(r => r.crew_payees)
    .map(r => ({
      category: categoryByRole.get(r.role_key) ?? "other",
      roleKey: r.role_key,
      name: r.crew_payees.full_name,
      phone: r.crew_payees.profiles?.phone ?? "",
      email: r.crew_payees.email ?? "",
      isDepartmentLead: r.is_department_lead,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || (b.isDepartmentLead ? 1 : 0) - (a.isDepartmentLead ? 1 : 0));
}
