import { supabase } from "../supabaseClient";

export interface CrewAccessDetails {
  grantId: string;
  payeeName: string;
  payeeDiscipline: string | null;
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  brandName: string;
  dueDate: string | null;
  expiresAt: string;
}

export async function redeemCrewAccess(accessCode: string): Promise<{ data: CrewAccessDetails | null; error: string | null }> {
  const { data, error } = await supabase.rpc("redeem_crew_access", { p_access_code: accessCode });
  if (error || !data || data.length === 0) {
    return { data: null, error: error?.message ?? "This access link isn't valid." };
  }
  const row = data[0];
  return {
    data: {
      grantId: row.grant_id,
      payeeName: row.payee_name,
      payeeDiscipline: row.payee_discipline,
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      campaignStatus: row.campaign_status,
      brandName: row.brand_name,
      dueDate: row.due_date,
      expiresAt: row.expires_at,
    },
    error: null,
  };
}
