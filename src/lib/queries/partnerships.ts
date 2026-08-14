import { supabase } from "../supabaseClient";

// Real "Invite Partner" flow, replacing the fully-decorative old Network
// tab (a hardcoded 4-agency list with a client-only "Add" toggle).
// Closed-loop by design — see 0035_partner_invites.sql's own comment —
// this is for brands/agencies who already know each other, not an open
// directory.

export interface Partner {
  orgId: string;
  name: string;
  orgType: "brand" | "agency";
  since: string; // partnership created_at
}

export async function fetchMyPartners(myOrgId: string, myOrgType: "brand" | "agency"): Promise<Partner[]> {
  const otherSideKey = myOrgType === "brand" ? "agency_org_id" : "brand_org_id";
  const myKey = myOrgType === "brand" ? "brand_org_id" : "agency_org_id";
  const { data, error } = await supabase
    .from("brand_agency_partnerships")
    .select(`created_at, ${otherSideKey}, organizations!brand_agency_partnerships_${otherSideKey}_fkey(id, name, org_type)`)
    .eq(myKey, myOrgId)
    .eq("status", "active");
  if (error || !data) return [];
  return (data as any[])
    .filter((r) => r.organizations)
    .map((r) => ({ orgId: r.organizations.id, name: r.organizations.name, orgType: r.organizations.org_type, since: r.created_at }));
}

export interface SentInvite {
  id: string;
  inviteeEmail: string;
  inviteeOrgName: string | null;
  token: string;
  status: "pending" | "accepted" | "revoked";
  expiresAt: string;
  createdAt: string;
}

export async function fetchMySentInvites(myOrgId: string): Promise<SentInvite[]> {
  const { data, error } = await supabase
    .from("partner_invites")
    .select("id, invitee_email, invitee_org_name, token, status, expires_at, created_at")
    .eq("inviting_org_id", myOrgId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    id: r.id, inviteeEmail: r.invitee_email, inviteeOrgName: r.invitee_org_name,
    token: r.token, status: r.status, expiresAt: r.expires_at, createdAt: r.created_at,
  }));
}

export async function createPartnerInvite(inviteeEmail: string, inviteeOrgName: string): Promise<{ token: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("create_partner_invite", {
    p_invitee_email: inviteeEmail,
    p_invitee_org_name: inviteeOrgName || null,
  });
  if (error) return { token: null, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { token: row?.invite_token ?? null, error: null };
}

export interface PartnerInviteDetails {
  inviteId: string;
  invitingOrgName: string;
  invitingOrgType: "brand" | "agency";
  inviteeOrgType: "brand" | "agency";
  status: "pending" | "accepted" | "revoked";
  expiresAt: string;
}

export async function fetchPartnerInviteByToken(token: string): Promise<PartnerInviteDetails | null> {
  const { data, error } = await supabase.rpc("fetch_partner_invite_by_token", { p_token: token });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    inviteId: row.invite_id, invitingOrgName: row.inviting_org_name, invitingOrgType: row.inviting_org_type,
    inviteeOrgType: row.invitee_org_type, status: row.status, expiresAt: row.expires_at,
  };
}

export async function acceptPartnerInvite(token: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("accept_partner_invite", { p_token: token });
  return { error: error?.message ?? null };
}
