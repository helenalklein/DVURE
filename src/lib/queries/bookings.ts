import { supabase } from "../supabaseClient";

// The platform fee is added on top of gross, never deducted from what
// a payee is owed, and varies by how the brand actually pays — ACH is
// cheaper for DVURE to process than card, so it's priced lower to
// steer volume there. Card/ACH add the fee directly to the charge
// (create-invoice-payment, which recomputes it fresh at payment time).
// A confirmed check/wire/cash payment bills the card rate separately
// afterward via a real Stripe Invoice (create-noncircumvention-invoice),
// since no money moves through Stripe on those to collect it from
// directly.
export const DEFAULT_AGENCY_PCT = 20;
export const PLATFORM_FEE_PCT_ACH = 5.5;
export const PLATFORM_FEE_PCT_CARD = 6;

// Booking creation goes through create_booking (RPC) rather than a
// plain client insert — who's actually owed money on a booking is real
// logic now, not a fixed split: it's the submitting agency's own
// per-relationship commission_pct (agency_model_relationships), plus
// any other 'always'-entitled relationship on the same model (the real
// mother-agency case — paid regardless of who books, deduped against
// the submitting agency if it's the same org), each landing as its own
// row in booking_agency_allocations. An independent model (agencyOrgId
// null) skips agency allocation entirely — no fee invented for nobody.
// The RPC derives brand_org_id from the caller's own session, and
// handles its own audit logging server-side.
export async function createBooking(params: {
  campaignId: string;
  submissionId: string | null;
  agencyOrgId: string | null;
  modelId: string;
  dayRate: number;
  days: number;
  shootDate: string; // YYYY-MM-DD
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

export interface ModelBooking {
  id: string;
  campaignName: string;
  brandName: string;
  agencyName: string | null; // null means independent -- no agency in the middle
  dayRate: number;
  days: number;
  shootDate: string;
}

// A model's own real bookings — bookings_select's RLS (model_id =
// my_model_id()) already scopes this to their own rows, agency-repped
// or independent alike. Deliberately doesn't attempt a payment status
// here: that's only ever knowable from DVURE's side for an independent
// booking (see fetchInvoicesForModel) -- an agency-repped booking pays
// the agency, and DVURE has no RLS-visible invoice to show the model
// what their agency did with it after that.
export async function fetchBookingsForModel(modelId: string): Promise<ModelBooking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, day_rate, days, shoot_date, campaigns(name, organizations(name)), agency:organizations!bookings_agency_org_id_fkey(name)")
    .eq("model_id", modelId)
    .order("shoot_date", { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    id: r.id,
    campaignName: r.campaigns?.name ?? "Unknown campaign",
    brandName: r.campaigns?.organizations?.name ?? "Unknown brand",
    agencyName: r.agency?.name ?? null,
    dayRate: Number(r.day_rate),
    days: Number(r.days),
    shootDate: r.shoot_date,
  }));
}

