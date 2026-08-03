import { supabase } from "../supabaseClient";

export interface AgencyInvitation {
  brand: string;
  campaign: string;
  type: string;
  due: string;
  budget: string;
  models: number;
  submissionOpen: string;
  submissionClose: string;
  realCampaignId: string;
}

function fmt(iso: string | null): string {
  if (!iso) return "TBD";
  // Same UTC-anchored formatting as campaigns.ts's formatDateLong — a
  // submission window only ever means a calendar day, never a specific
  // moment, so this must match regardless of the viewer's timezone.
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// The real half of what InvitationsView shows — every campaign a brand
// has actually distributed to this agency (campaign_agency_distributions),
// not just the one pre-seeded mock/real pair (AW25) the original build
// hard-wired. RLS already covers this: an agency can see a campaign via
// agency_distributed_on(), and the brand org via the same partnership
// that made the distribution possible in the first place — no new
// policy needed.
export async function fetchAgencyInvitations(agencyOrgId: string): Promise<AgencyInvitation[]> {
  const { data, error } = await supabase
    .from("campaign_agency_distributions")
    .select("campaigns(id, name, type, status, due_date, submission_open, submission_close, talent_needed, budget, organizations(name))")
    .eq("agency_org_id", agencyOrgId);
  if (error || !data) return [];

  return (data as any[])
    .filter((r) => r.campaigns && r.campaigns.status === "active")
    .map((r) => {
      const c = r.campaigns;
      return {
        brand: c.organizations?.name ?? "",
        campaign: c.name,
        type: c.type,
        due: fmt(c.due_date),
        budget: c.budget != null ? `$${Number(c.budget).toLocaleString()}` : "Budget TBD",
        models: c.talent_needed ?? 0,
        submissionOpen: fmt(c.submission_open),
        submissionClose: fmt(c.submission_close),
        realCampaignId: c.id as string,
      };
    });
}
