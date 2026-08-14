import { supabase } from "../supabaseClient";

// Purely descriptive (spec §20) — never read by any RLS/RPC decision,
// same posture as the org's client-writable `name` column. A direct
// update is safe here (no RPC needed) since organizations_write's
// column-level grant (0031) is the only thing gating this field.
export async function updateSelfDescribedServices(orgId: string, services: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("organizations")
    .update({ self_described_services: services })
    .eq("id", orgId);
  return { error: error?.message ?? null };
}
