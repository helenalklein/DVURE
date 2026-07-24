import { supabase } from "../supabaseClient";

export async function createModelInvite(
  agencyOrgId: string,
  invitedByProfileId: string,
  modelId: string,
  email: string
): Promise<{ token: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("invites")
    .insert({
      email,
      role: "model",
      org_id: agencyOrgId, // required by invites_write RLS — a null org_id is rejected outright
      model_id: modelId,
      agency_relationship_type: "mother",
      invited_by_profile_id: invitedByProfileId,
    })
    .select("token")
    .single();
  if (error || !data) return { token: null, error: error?.message ?? "Couldn't create invite." };
  return { token: data.token as string, error: null };
}

export interface InviteDetails {
  inviteId: string;
  email: string;
  role: string;
  orgName: string | null;
  modelFullName: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string;
}

export async function getInviteByToken(token: string): Promise<InviteDetails | null> {
  const { data, error } = await supabase.rpc("get_invite_by_token", { p_token: token });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    inviteId: row.invite_id,
    email: row.email,
    role: row.role,
    orgName: row.org_name,
    modelFullName: row.model_full_name,
    status: row.status,
    expiresAt: row.expires_at,
  };
}
