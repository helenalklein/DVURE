import { supabase } from "../supabaseClient";

// Agency-vs-model split is now per-relationship (agency_model_relationships.
// commission_pct, see 0038) — this is only the fallback used when a
// relationship hasn't set its own, matching default_commission_pct() in
// that same migration. Keep the two numbers in sync by hand.
export const DEFAULT_AGENCY_PCT = 20;

// Real platform fee (card 6% / ACH 5.5%) — mirrors
// create-invoice-payment's own copy of this table; charged on top of
// gross at payment time, not stored per-booking (see 0039's own
// comment for why "the fee" used to be an implicit, invisible thing
// rather than a real charge, and why that couldn't support a
// method-dependent discount).
export const PLATFORM_FEE_PCT_BY_METHOD: Record<"ach" | "card", number> = { ach: 5.5, card: 6 };

// bookings moved to a real RPC (create_booking, 0038) instead of a raw
// client insert — computing which agencies are actually owed money on
// this booking (the submitting agency, plus any 'always'-entitled
// mother agencies on the same model, deduped if they're the same org)
// is real logic a client shouldn't be trusted to get right, matching
// this schema's usual RPC-wrapped-mutation pattern.
export async function createBooking(params: {
  campaignId: string;
  submissionId: string | null;
  modelId: string;
  dayRate: number;
  days: number;
  shootDate: string; // YYYY-MM-DD
  agencyOrgId: string | null;
}): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("create_booking", {
    p_campaign_id: params.campaignId,
    p_submission_id: params.submissionId,
    p_model_id: params.modelId,
    p_day_rate: params.dayRate,
    p_days: params.days,
    p_shoot_date: params.shootDate,
    p_booking_agency_org_id: params.agencyOrgId,
  });
  if (error || !data) return { id: null, error: error?.message ?? "Couldn't create booking." };
  return { id: data as string, error: null };
}

export interface UnpaidBooking {
  id: string;
  modelName: string;
  agencyOrgId: string;
  agencyName: string;
  dayRate: number;
  days: number;
  grossAmount: number; // day_rate * days — what the brand is charged for this line
}

export async function fetchUnpaidBookings(campaignId: string): Promise<UnpaidBooking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, day_rate, days, agency_org_id, model_profiles(full_name), organizations!bookings_agency_org_id_fkey(name)")
    .eq("campaign_id", campaignId)
    .neq("payment_status", "paid");
  if (error || !data) return [];

  return (data as any[]).map((b) => ({
    id: b.id,
    modelName: b.model_profiles?.full_name ?? "Unknown",
    agencyOrgId: b.agency_org_id,
    agencyName: b.organizations?.name ?? "Unknown agency",
    dayRate: Number(b.day_rate),
    days: Number(b.days),
    grossAmount: Number(b.day_rate) * Number(b.days),
  }));
}
