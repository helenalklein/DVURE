import { supabase } from "../supabaseClient";
import { logAuditEvent, hashArtifact } from "../audit";

export type ContractStatus = "draft" | "awaiting_signature" | "fully_executed";

export interface Contract {
  id: string;
  contractNumber: string;
  modelId: string;
  modelName: string;
  dayRate: number;
  agencyPct: number;
  territory: string;
  duration: string;
  status: ContractStatus;
  sentAt: string | null;
  executedAt: string | null;
  createdAt: string;
}

export async function fetchCampaignContracts(campaignId: string): Promise<Contract[]> {
  const { data, error } = await supabase
    .from("contracts")
    .select("id, contract_number, model_id, day_rate, agency_pct, territory, duration, status, sent_at, executed_at, created_at, model_profiles(full_name)")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    id: r.id,
    contractNumber: r.contract_number,
    modelId: r.model_id,
    modelName: r.model_profiles?.full_name ?? "Unknown",
    dayRate: Number(r.day_rate),
    agencyPct: Number(r.agency_pct),
    territory: r.territory,
    duration: r.duration,
    status: r.status as ContractStatus,
    sentAt: r.sent_at,
    executedAt: r.executed_at,
    createdAt: r.created_at,
  }));
}

export interface ModelContract {
  id: string;
  contractNumber: string;
  campaignName: string;
  brandName: string;
  dayRate: number;
  agencyPct: number;
  territory: string;
  duration: string;
  status: ContractStatus;
  sentAt: string | null;
  executedAt: string | null;
  modelSignatureName: string | null;
  signedByModelAt: string | null;
  createdAt: string;
}

// contracts_select_own_model (0083) scopes this to the model's own
// rows — no campaign_id filter needed, mirrors fetchBookingsForModel's
// pattern of trusting RLS rather than re-deriving the scope client-side.
export async function fetchContractsForModel(modelId: string): Promise<ModelContract[]> {
  const { data, error } = await supabase
    .from("contracts")
    .select("id, contract_number, day_rate, agency_pct, territory, duration, status, sent_at, executed_at, model_signature_name, signed_by_model_at, created_at, campaigns(name, organizations(name))")
    .eq("model_id", modelId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    id: r.id,
    contractNumber: r.contract_number,
    campaignName: r.campaigns?.name ?? "Unknown project",
    brandName: r.campaigns?.organizations?.name ?? "Unknown brand",
    dayRate: Number(r.day_rate),
    agencyPct: Number(r.agency_pct),
    territory: r.territory,
    duration: r.duration,
    status: r.status as ContractStatus,
    sentAt: r.sent_at,
    executedAt: r.executed_at,
    modelSignatureName: r.model_signature_name,
    signedByModelAt: r.signed_by_model_at,
    createdAt: r.created_at,
  }));
}

// The model's own in-app "type your name" signature — sign_contract_as_model
// (0083) re-validates ownership and status server-side, so there's nothing
// to enforce client-side beyond a non-empty typed name.
export async function signContractAsModel(contractId: string, typedName: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("sign_contract_as_model", {
    p_contract_id: contractId,
    p_typed_name: typedName,
  });
  return { error: error?.message ?? null };
}

// contract_number is server-generated (set_contract_number() trigger,
// 0032) — never client-supplied, so two brands generating a contract at
// the same moment can't collide on the same number.
export async function createContract(params: {
  campaignId: string;
  modelId: string;
  dayRate: number;
  agencyPct?: number;
  territory?: string;
  duration?: string;
  createdByProfileId: string;
  sendImmediately?: boolean;
}): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("contracts")
    .insert({
      campaign_id: params.campaignId,
      model_id: params.modelId,
      day_rate: params.dayRate,
      agency_pct: params.agencyPct ?? 0.20,
      territory: params.territory ?? "United States",
      duration: params.duration ?? "1 year",
      status: params.sendImmediately ? "awaiting_signature" : "draft",
      sent_at: params.sendImmediately ? new Date().toISOString() : null,
      created_by_profile_id: params.createdByProfileId,
    })
    .select("id")
    .single();
  if (error || !data) return { id: null, error: error?.message ?? "Couldn't create contract." };
  logAuditEvent({
    action: params.sendImmediately ? "contract.created_and_sent" : "contract.created",
    objectType: "contract",
    objectId: data.id as string,
    campaignId: params.campaignId,
    newValue: { modelId: params.modelId, dayRate: params.dayRate },
  });
  return { id: data.id as string, error: null };
}

export async function sendContract(contractId: string, campaignId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("contracts")
    .update({ status: "awaiting_signature", sent_at: new Date().toISOString() })
    .eq("id", contractId);
  if (!error) logAuditEvent({ action: "contract.sent", objectType: "contract", objectId: contractId, campaignId });
  return { error: error?.message ?? null };
}

// No real e-signature integration exists yet — this records that
// signature happened outside the system (paper, DocuSign, email),
// which is an honest MVP posture rather than faking an in-app sign
// flow. The artifact hash still gives compliance a real, checkable
// record of exactly what terms were marked executed.
export async function markContractExecuted(
  contractId: string,
  campaignId: string,
  canonicalContent: Record<string, unknown>
): Promise<{ error: string | null }> {
  const hash = await hashArtifact(canonicalContent);
  const { error } = await supabase
    .from("contracts")
    .update({ status: "fully_executed", executed_at: new Date().toISOString() })
    .eq("id", contractId);
  if (!error) {
    logAuditEvent({
      action: "contract.executed",
      objectType: "contract",
      objectId: contractId,
      campaignId,
      newValue: canonicalContent,
      artifactHash: hash,
    });
  }
  return { error: error?.message ?? null };
}
