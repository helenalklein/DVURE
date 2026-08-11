import { supabase } from "../supabaseClient";
import { logAuditEvent } from "../audit";

// Fee split isn't a per-booking negotiation in the UI yet — every real
// booking uses the platform's own standard split. Revisit if/when
// brands need to negotiate this per deal.
//
// The platform fee is added on top of gross, never deducted from what
// a payee is owed, and varies by how the brand actually pays — ACH is
// cheaper for DVURE to process than card, so it's priced lower to
// steer volume there. Card/ACH add the fee directly to the charge
// (create-invoice-payment, which recomputes it fresh at payment time —
// bookings.platform_pct below is only ever a stored-for-reference
// default, never read back for the real charge). A confirmed check/
// wire/cash payment bills the card rate separately afterward via a
// real Stripe Invoice (create-noncircumvention-invoice), since no
// money moves through Stripe on those to collect it from directly.
export const DEFAULT_AGENCY_PCT = 20;
export const PLATFORM_FEE_PCT_ACH = 5.5;
export const PLATFORM_FEE_PCT_CARD = 6;

export async function createBooking(params: {
  campaignId: string;
  submissionId: string;
  brandOrgId: string;
  agencyOrgId: string | null;
  modelId: string;
  dayRate: number;
  days: number;
  shootDate: string; // YYYY-MM-DD
}): Promise<{ id: string | null; error: string | null }> {
  // No agency on the booking (an independent model, 0049) means no
  // agency cut — agency_pct silently defaulting to the standard 20% here
  // would invent a fee owed to nobody.
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
      agency_pct: params.agencyOrgId ? DEFAULT_AGENCY_PCT / 100 : 0,
      platform_pct: PLATFORM_FEE_PCT_CARD / 100,
    })
    .select("id")
    .single();
  if (error || !data) return { id: null, error: error?.message ?? "Couldn't create booking." };

  // Same client-side (skippable) audit tier as submissions — bookings
  // has no security-definer RPC of its own yet either.
  logAuditEvent({
    action: "booking.created",
    objectType: "booking",
    objectId: data.id as string,
    campaignId: params.campaignId,
    newValue: { modelId: params.modelId, dayRate: params.dayRate, days: params.days, shootDate: params.shootDate },
  });

  return { id: data.id as string, error: null };
}

