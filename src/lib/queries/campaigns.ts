import { supabase } from "../supabaseClient";
import type { Campaign, CampaignType, CampaignStatus } from "../../app/shared/types";

// Still used by AgencyApp.tsx's submission flow, which has no merged
// real+mock campaign list/shim of its own (out of scope this pass) — an
// agency just needs to know whether a campaign name it's submitting to
// has a real row yet, same anchor pattern as before.
export async function findCampaignIdByName(name: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("id")
    .eq("name", name)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0].id as string;
}

// Real campaigns get synthetic sequential ids in their own offset range,
// clear of submissions.ts's 100_000 range — same shim pattern, so
// Campaign.id never has to become a string across the whole app.
const CAMPAIGN_SHIM_BASE = 500_000;

function formatDateShort(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
}

function formatDateLong(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dueLabelAndUrgency(dueDateIso: string | null): { dueLabel: string; dueUrgency: "high" | "medium" | "low" } {
  if (!dueDateIso) return { dueLabel: "No due date set", dueUrgency: "low" };
  const days = Math.ceil((new Date(dueDateIso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { dueLabel: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`, dueUrgency: "high" };
  if (days === 0) return { dueLabel: "Due today", dueUrgency: "high" };
  if (days === 1) return { dueLabel: "Due tomorrow", dueUrgency: "high" };
  if (days <= 7) return { dueLabel: `${days} days remaining`, dueUrgency: "medium" };
  return { dueLabel: `${days} days remaining`, dueUrgency: "low" };
}

export async function fetchPartneredAgencies(brandOrgId: string): Promise<{ id: string; name: string }[]> {
  // brand_agency_partnerships has two FK columns into organizations
  // (brand_org_id and agency_org_id) — the embed must name the specific
  // constraint or PostgREST can't tell which side to join.
  const { data, error } = await supabase
    .from("brand_agency_partnerships")
    .select("organizations!brand_agency_partnerships_agency_org_id_fkey(id, name)")
    .eq("brand_org_id", brandOrgId)
    .eq("status", "active");
  if (error || !data) return [];
  return (data as any[])
    .filter(r => r.organizations)
    .map(r => ({ id: r.organizations.id as string, name: r.organizations.name as string }));
}

export async function fetchBrandCampaigns(brandOrgId: string): Promise<{ campaigns: Campaign[]; realIdShim: Map<number, string> }> {
  const { data: rows, error } = await supabase
    .from("campaigns")
    .select("id, name, type, status, due_date, submission_open, submission_close, talent_needed, budget, created_at")
    .eq("brand_org_id", brandOrgId)
    .order("created_at", { ascending: true }); // stable shim ids across reloads — a real deep link depends on this

  if (error || !rows || rows.length === 0) return { campaigns: [], realIdShim: new Map() };

  const realIds = rows.map((r: any) => r.id);
  const { data: subs } = await supabase.from("submissions").select("campaign_id, stage").in("campaign_id", realIds);

  const counts = new Map<string, { submitted: number; approved: number; booked: number }>();
  for (const s of (subs ?? []) as any[]) {
    const c = counts.get(s.campaign_id) ?? { submitted: 0, approved: 0, booked: 0 };
    if (s.stage === "submitted") c.submitted++;
    else if (s.stage === "approved") c.approved++;
    else if (s.stage === "booked") c.booked++;
    counts.set(s.campaign_id, c);
  }

  const realIdShim = new Map<number, string>();
  const campaigns: Campaign[] = rows.map((r: any, i: number) => {
    const id = CAMPAIGN_SHIM_BASE + i;
    realIdShim.set(id, r.id);
    const { dueLabel, dueUrgency } = dueLabelAndUrgency(r.due_date);
    const c = counts.get(r.id) ?? { submitted: 0, approved: 0, booked: 0 };
    const budget = r.budget ?? 0;
    return {
      id,
      name: r.name,
      type: r.type as CampaignType,
      status: r.status as CampaignStatus,
      due: formatDateShort(r.due_date),
      dueLabel,
      dueUrgency,
      submissionOpen: formatDateLong(r.submission_open),
      submissionClose: formatDateLong(r.submission_close),
      submitted: c.submitted,
      approved: c.approved,
      booked: c.booked,
      talentNeeded: r.talent_needed ?? 0,
      budget,
      committed: 0,
      remaining: budget,
    };
  });

  return { campaigns, realIdShim };
}

export async function createCampaign(params: {
  brandOrgId: string;
  createdByProfileId: string;
  name: string;
  type: CampaignType;
  status: "active" | "drafts";
  dueDate?: string;
  submissionOpen?: string;
  submissionClose?: string;
  talentNeeded?: number;
  budget?: number;
}): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      brand_org_id: params.brandOrgId,
      name: params.name,
      type: params.type,
      status: params.status,
      due_date: params.dueDate || null,
      submission_open: params.submissionOpen || null,
      submission_close: params.submissionClose || null,
      talent_needed: params.talentNeeded ?? null,
      budget: params.budget ?? null,
      created_by_profile_id: params.createdByProfileId,
    })
    .select("id")
    .single();
  if (error || !data) return { id: null, error: error?.message ?? "Couldn't create campaign." };
  return { id: data.id as string, error: null };
}

// Never call this for a draft — campaigns_select RLS has no status
// filter, so a distribution row makes a campaign visible to that agency
// regardless of status.
export async function distributeCampaignToAgencies(
  campaignId: string,
  agencyOrgIds: string[],
  invitedByProfileId: string
): Promise<{ error: string | null }> {
  if (agencyOrgIds.length === 0) return { error: null };
  const { error } = await supabase
    .from("campaign_agency_distributions")
    .insert(agencyOrgIds.map(agencyOrgId => ({
      campaign_id: campaignId,
      agency_org_id: agencyOrgId,
      invited_by_profile_id: invitedByProfileId,
    })));
  return { error: error?.message ?? null };
}
