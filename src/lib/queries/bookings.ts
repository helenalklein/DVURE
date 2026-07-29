import { supabase } from "../supabaseClient";

// Fee split isn't a per-booking negotiation in the UI yet — every real
// booking uses the platform's own standard split, the same numbers the
// mock BOOKINGS data has always used (see bookingBreakdown() in
// mockData.ts). Revisit if/when brands need to negotiate this per deal.
export const DEFAULT_AGENCY_PCT = 20;
export const DEFAULT_PLATFORM_PCT = 3;

export async function createBooking(params: {
  campaignId: string;
  submissionId: string;
  brandOrgId: string;
  agencyOrgId: string;
  modelId: string;
  dayRate: number;
  days: number;
  shootDate: string; // YYYY-MM-DD
}): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      campaign_id: params.campaignId,
      submission_id: params.submissionId,
      brand_org_id: params.brandOrgId,
      agency_org_id: params.agencyOrgId,
      model_id: params.modelId,
      day_rate: params.dayRate,
      days: params.days,
      shoot_date: params.shootDate,
      agency_pct: DEFAULT_AGENCY_PCT / 100,
      platform_pct: DEFAULT_PLATFORM_PCT / 100,
    })
    .select("id")
    .single();
  if (error || !data) return { id: null, error: error?.message ?? "Couldn't create booking." };
  return { id: data.id as string, error: null };
}
