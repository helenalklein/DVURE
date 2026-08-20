import { supabase } from "../supabaseClient";
import { logAuditEvent } from "../audit";
import { patchDayRateInDocument } from "./contracts";

export type NegotiationAuthorRole = "brand" | "agency" | "model";
export type NegotiationKind = "message" | "offer" | "accept";

export interface NegotiationEntry {
  id: string;
  authorName: string;
  authorRole: NegotiationAuthorRole;
  kind: NegotiationKind;
  amount: number | null;
  text: string | null;
  createdAt: string;
}

export interface ActiveNegotiation {
  contractId: string;
  campaignId: string;
  modelId: string;
  campaignName: string;
  brandName: string;
  dayRate: number;
}

// Agencies had zero contract visibility before this feature
// (contracts_select_agency, 0101) — RLS already scopes this to exactly
// the models this agency submitted, so no org filter is needed
// client-side; awaiting_signature is the only real "open for
// negotiation" state (draft hasn't been sent yet, fully_executed is
// done). Powers the Roster card's Active Negotiations section.
export async function fetchActiveNegotiationsForAgency(): Promise<ActiveNegotiation[]> {
  const { data, error } = await supabase
    .from("contracts")
    .select("id, campaign_id, model_id, day_rate, campaigns(name, organizations(name))")
    .eq("status", "awaiting_signature");
  if (error || !data) return [];
  return (data as any[]).map(r => ({
    contractId: r.id,
    campaignId: r.campaign_id,
    modelId: r.model_id,
    campaignName: r.campaigns?.name ?? "Unknown project",
    brandName: r.campaigns?.organizations?.name ?? "Unknown brand",
    dayRate: Number(r.day_rate),
  }));
}

export async function fetchThread(contractId: string): Promise<NegotiationEntry[]> {
  const { data, error } = await supabase
    .from("rate_negotiations")
    .select("id, author_role, kind, amount, text, created_at, profiles(full_name)")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as any[]).map(r => ({
    id: r.id,
    authorName: r.profiles?.full_name ?? "Someone",
    authorRole: r.author_role as NegotiationAuthorRole,
    kind: r.kind as NegotiationKind,
    amount: r.amount != null ? Number(r.amount) : null,
    text: r.text,
    createdAt: r.created_at,
  }));
}

export async function postMessage(contractId: string, authorProfileId: string, authorRole: NegotiationAuthorRole, text: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("rate_negotiations").insert({
    contract_id: contractId, author_profile_id: authorProfileId, author_role: authorRole, kind: "message", text,
  });
  return { error: error?.message ?? null };
}

export async function postOffer(contractId: string, authorProfileId: string, authorRole: NegotiationAuthorRole, amount: number, text?: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("rate_negotiations").insert({
    contract_id: contractId, author_profile_id: authorProfileId, author_role: authorRole, kind: "offer", amount, text: text || null,
  });
  return { error: error?.message ?? null };
}

// Routed through accept_rate_offer (0101) rather than a plain client
// update — contracts_write only lets the brand's own admin/enhanced
// members UPDATE the contracts row, so a model or agency accepting an
// offer (the brand accepting a counter is the one case that COULD go
// through a plain client update, but this keeps every party on one
// code path) needs a security-definer RPC that re-validates the caller
// is actually a party to this contract, same posture as
// sign_contract_as_model. Recording the acceptance and moving the live
// rate happen atomically server-side rather than as two separate writes
// that could partially fail.
//
// Fetches the contract's current document_html itself right before
// patching, rather than trusting a copy the caller might be holding —
// three different embeddings (CompCard popup, roster card, ContractsView)
// call this, and none of them should have to keep their own document
// state in sync just to accept an offer.
export async function acceptOffer(params: {
  contractId: string; campaignId: string; amount: number;
}): Promise<{ error: string | null }> {
  const { data: row } = await supabase.from("contracts").select("document_html").eq("id", params.contractId).maybeSingle();
  const patchedHtml = row?.document_html ? patchDayRateInDocument(row.document_html, `$${params.amount}/day`) : null;
  const { error } = await supabase.rpc("accept_rate_offer", {
    p_contract_id: params.contractId,
    p_amount: params.amount,
    p_document_html: patchedHtml,
  });
  if (error) return { error: error.message };
  logAuditEvent({
    action: "contract.rate_agreed",
    objectType: "contract",
    objectId: params.contractId,
    campaignId: params.campaignId,
    newValue: { dayRate: params.amount },
  });
  return { error: null };
}
