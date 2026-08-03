import { supabase } from "../supabaseClient";

export interface AuditLogEntry {
  id: string;
  occurredAt: string;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  objectType: string | null;
  objectId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  previousValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
}

// Administrator-only, scoped server-side to the caller's own org — see
// fetch_org_audit_log() in migration 0027. before lets the caller page
// further back in time (occurred_at cursor), not an offset.
export async function fetchOrgAuditLog(before?: string): Promise<{ entries: AuditLogEntry[]; error: string | null }> {
  const { data, error } = await supabase.rpc("fetch_org_audit_log", { p_limit: 100, p_before: before ?? null });
  if (error) return { entries: [], error: error.message };
  const entries = (data as any[]).map((r) => ({
    id: r.id,
    occurredAt: r.occurred_at,
    actorName: r.actor_name,
    actorEmail: r.actor_email,
    action: r.action,
    objectType: r.object_type,
    objectId: r.object_id,
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    previousValue: r.previous_value,
    newValue: r.new_value,
    ipAddress: r.ip_address,
    userAgent: r.user_agent,
  }));
  return { entries, error: null };
}
