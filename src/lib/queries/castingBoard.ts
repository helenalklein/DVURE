import { supabase } from "../supabaseClient";
import type { CastingStageId } from "../../app/shared/types";

export interface RealCastingEntry {
  modelId: string;
  confirmed: boolean;
  optioned: boolean;
  fittingComplete: boolean;
  rehearsalComplete: boolean;
  checkedIn: boolean;
  walked: boolean;
  wrapComplete: boolean;
}

const STAGE_COLUMN: Record<CastingStageId, string> = {
  confirmed: "confirmed",
  optioned: "optioned",
  fittingComplete: "fitting_complete",
  rehearsalComplete: "rehearsal_complete",
  checkedIn: "checked_in",
  walked: "walked",
  wrapComplete: "wrap_complete",
};

// casting_entries already existed in the schema (0001_init.sql) with
// full RLS (0002_rls.sql) — this was only ever missing frontend wiring,
// which is why the Casting Board showed "No models cast yet" even with
// a real booking on the campaign.
export async function fetchCastingEntries(campaignId: string): Promise<Map<string, RealCastingEntry>> {
  const { data, error } = await supabase
    .from("casting_entries")
    .select("model_id, confirmed, optioned, fitting_complete, rehearsal_complete, checked_in, walked, wrap_complete")
    .eq("campaign_id", campaignId);
  if (error || !data) return new Map();
  const map = new Map<string, RealCastingEntry>();
  for (const r of data as any[]) {
    map.set(r.model_id, {
      modelId: r.model_id,
      confirmed: r.confirmed, optioned: r.optioned, fittingComplete: r.fitting_complete,
      rehearsalComplete: r.rehearsal_complete, checkedIn: r.checked_in, walked: r.walked, wrapComplete: r.wrap_complete,
    });
  }
  return map;
}

// One column per call, upserted — casting_entries_write's RLS already
// restricts this to the campaign's own brand admin/enhanced staff, so
// there's no need for a security-definer RPC just to flip a checkbox.
export async function setCastingStage(campaignId: string, modelId: string, stageId: CastingStageId, value: boolean): Promise<{ error: string | null }> {
  const column = STAGE_COLUMN[stageId];
  const { error } = await supabase
    .from("casting_entries")
    .upsert({ campaign_id: campaignId, model_id: modelId, [column]: value }, { onConflict: "campaign_id,model_id" });
  return { error: error?.message ?? null };
}
