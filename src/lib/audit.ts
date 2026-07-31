import { supabase } from "./supabaseClient";

// Client-side call into record_audit_event() (0018 migration). This is
// the WEAKER half of the audit system — a client-side call can in
// theory be skipped by a buggy caller, unlike the logging embedded
// directly inside complete_org_signup()/record_payment_attempt(),
// which happens in the same transaction as the write and can't be
// bypassed. Use this for write paths that are still plain client
// inserts/updates (submissions, bookings) until those get converted to
// security-definer RPCs of their own — call it immediately after the
// write succeeds, from the query module itself rather than scattered
// UI call sites, so no caller has to remember to log separately.
export async function logAuditEvent(params: {
  action: string;
  objectType?: string;
  objectId?: string;
  campaignId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  artifactHash?: string;
}) {
  const { error } = await supabase.rpc("record_audit_event", {
    p_action: params.action,
    p_object_type: params.objectType ?? null,
    p_object_id: params.objectId ?? null,
    p_campaign_id: params.campaignId ?? null,
    p_previous_value: params.previousValue ?? null,
    p_new_value: params.newValue ?? null,
    p_request_id: crypto.randomUUID(),
    p_artifact_hash: params.artifactHash ?? null,
  });
  if (error) console.error("logAuditEvent failed:", params.action, error.message);
}

// SHA-256 hash of a signed artifact's canonical content — for the
// "cryptographic hash" field on actions that represent someone signing
// something (a contract, a payment authorization). Callers build the
// canonical object themselves (whatever fields actually constitute
// "what was signed") rather than this function guessing a shape.
export async function hashArtifact(content: Record<string, unknown>): Promise<string> {
  const canonical = JSON.stringify(content, Object.keys(content).sort());
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}
