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
  documentHtml: string | null;
}

export async function fetchCampaignContracts(campaignId: string): Promise<Contract[]> {
  const { data, error } = await supabase
    .from("contracts")
    .select("id, contract_number, model_id, day_rate, agency_pct, territory, duration, status, sent_at, executed_at, created_at, document_html, model_profiles(full_name)")
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
    documentHtml: r.document_html ?? null,
  }));
}

export interface ModelContract {
  id: string;
  campaignId: string;
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
  documentHtml: string | null;
}

// contracts_select_own_model (0083) scopes this to the model's own
// rows — no campaign_id filter needed, mirrors fetchBookingsForModel's
// pattern of trusting RLS rather than re-deriving the scope client-side.
export async function fetchContractsForModel(modelId: string): Promise<ModelContract[]> {
  const { data, error } = await supabase
    .from("contracts")
    .select("id, campaign_id, contract_number, day_rate, agency_pct, territory, duration, status, sent_at, executed_at, model_signature_name, signed_by_model_at, created_at, document_html, campaigns(name, organizations(name))")
    .eq("model_id", modelId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    id: r.id,
    campaignId: r.campaign_id,
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
    documentHtml: r.document_html ?? null,
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

// Escape the resolved value itself — it's plain deal-term text (a
// model's name, a rate) landing inside HTML, not something already
// safe to inject raw.
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Wraps a resolved merge tag in a visible "the system filled this in"
// marker — inline styles, not Tailwind classes, since this HTML is
// stored as a raw string and rendered via a contenteditable's innerHTML
// (RichTextEditor), never through JSX/Tailwind's build-time class scan.
// var(--foreground) still resolves correctly there: CSS custom properties
// cascade to any DOM subtree regardless of how the markup was inserted.
// Neutral black/gray, not a brand accent color — this app's color scheme
// is black/white by design, real palette work deferred to a designer.
function mergeFieldSpan(label: string, value: string): string {
  return `<span data-merge-field="${label}" title="Auto-filled: ${label}" style="background:rgba(30,28,26,0.08);border-bottom:1px solid var(--foreground);border-radius:2px;padding:0 2px;">${escapeHtml(value)}</span>`;
}

// The empty counterpart — any {{tag}} the template references that
// isn't in the known set below (a field this fixed tag list doesn't
// cover yet, e.g. something the brand's own uploaded contract asks for)
// renders as a visibly blank, fillable-looking placeholder instead of
// either leaking raw "{{tag}}" syntax into the document or silently
// deleting a spot that needs real input.
function blankFieldSpan(label: string): string {
  return `<span data-merge-field-blank="${label}" title="Needs input: ${label}" style="background:rgba(110,103,93,0.12);border-bottom:1px dashed var(--muted-foreground);border-radius:2px;padding:0 4px;color:var(--muted-foreground);">[${label}]</span>`;
}

function tagLabel(tag: string): string {
  return tag.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Removes an entire optional section (0100's <div data-optional-section="...">
// wrapper around 3.2 Overtime / 3.3 Additional Services) when the
// project hasn't opted into it, rather than leaving it in with blank
// tags — these are terms that plainly don't apply to a project that
// never turned them on, not deal points someone forgot to fill in. Runs
// before resolveContractMergeTags so there's nothing left inside a
// stripped section for the tag resolver to touch. Non-greedy match is
// safe here: content_html never nests one data-optional-section inside
// another.
export function stripOptionalSections(html: string, flags: { includeOvertime: boolean; includeAdditionalServices: boolean }): string {
  let out = html;
  if (!flags.includeOvertime) {
    out = out.replace(/<div data-optional-section="overtime">[\s\S]*?<\/div>\s*/, "");
  }
  if (!flags.includeAdditionalServices) {
    out = out.replace(/<div data-optional-section="additional_services">[\s\S]*?<\/div>\s*/, "");
  }
  return out;
}

// Updates just the rendered Day Rate value inside an already-resolved
// document — used when a negotiation (rateNegotiations.ts) lands on a
// new number after the document was frozen. A full re-resolve isn't an
// option: only the resolved HTML is stored on the contract row, not the
// original template with its {{day_rate}} tag still in it. Targets the
// exact span mergeFieldSpan("Day Rate", ...) would have produced at
// send time — if a brand's template never referenced {{day_rate}} at
// all (no span to find), this is a harmless no-op; the new number still
// lands in contracts.day_rate, which is what every other view reads.
export function patchDayRateInDocument(html: string, formattedAmount: string): string {
  return html.replace(/<span data-merge-field="Day Rate"[^>]*>.*?<\/span>/, mergeFieldSpan("Day Rate", formattedAmount));
}

// Not a real templating engine — this fixed tag set is all a contract
// template needs to reference from the deal terms already on the modal
// that resolves it (ContractModal, BrandApp.tsx). Every known tag
// renders as a labeled "auto-filled" field (mergeFieldSpan); anything
// else shaped like {{a_tag}} that isn't recognized renders as a visibly
// blank field instead (blankFieldSpan) rather than silently vanishing.
export function resolveContractMergeTags(html: string, tags: {
  modelName: string; dayRate: string; territory: string; duration: string; brandName: string; contractNumber?: string;
  projectName?: string; modelEmail?: string;
  projectType?: string; shootDates?: string; shootLocation?: string; brandAddress?: string;
  senderName?: string; senderTitle?: string; sentDate?: string; projectId?: string;
  overtimeRate?: string; overtimeIncrementMinutes?: string; overtimeIncludedHours?: string;
}): string {
  const known: Record<string, string> = {
    model_name: tags.modelName,
    day_rate: tags.dayRate,
    territory: tags.territory,
    duration: tags.duration,
    brand_name: tags.brandName,
    contract_number: tags.contractNumber ?? "",
    project_name: tags.projectName ?? "",
    model_email: tags.modelEmail ?? "",
    project_type: tags.projectType ?? "",
    shoot_dates: tags.shootDates ?? "",
    shoot_location: tags.shootLocation ?? "",
    brand_address: tags.brandAddress ?? "",
    sender_name: tags.senderName ?? "",
    sender_title: tags.senderTitle ?? "",
    sent_date: tags.sentDate ?? "",
    project_id: tags.projectId ?? "",
    overtime_rate: tags.overtimeRate ?? "",
    overtime_increment: tags.overtimeIncrementMinutes ?? "",
    overtime_included_hours: tags.overtimeIncludedHours ?? "",
  };
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, rawTag: string) => {
    const tag = rawTag.toLowerCase();
    const label = tagLabel(tag);
    if (tag in known && known[tag]) return mergeFieldSpan(label, known[tag]);
    return blankFieldSpan(label);
  });
}

// contract_number is server-generated (set_contract_number() trigger,
// 0032) — never client-supplied, so two brands generating a contract at
// the same moment can't collide on the same number. documentHtml is
// written here, once — the resolved snapshot at creation time, not
// re-resolved later even if the source template changes afterward.
export async function createContract(params: {
  campaignId: string;
  modelId: string;
  dayRate: number;
  agencyPct?: number;
  territory?: string;
  duration?: string;
  createdByProfileId: string;
  sendImmediately?: boolean;
  contractTemplateId?: string;
  documentHtml?: string;
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
      contract_template_id: params.contractTemplateId ?? null,
      document_html: params.documentHtml ?? null,
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

// Draft-only, enforced server-side (contracts_delete_draft_only, 0096) —
// a contract that's ever been sent or executed can't be deleted through
// this or any other path; the RLS policy is the real gate, this call
// just fails with a permission error if status isn't 'draft'.
export async function deleteContract(contractId: string, campaignId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("contracts").delete().eq("id", contractId);
  if (!error) logAuditEvent({ action: "contract.deleted", objectType: "contract", objectId: contractId, campaignId });
  return { error: error?.message ?? null };
}
