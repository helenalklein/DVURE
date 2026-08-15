import { supabase } from "../supabaseClient";

// The real deliverables tracker (0076) — distinct from deliverables.ts,
// which despite its name is the shoot-day/hours editor from an earlier
// naming era (the "Schedule" tab). This tracks what the project owes:
// selects, final assets, approvals, whatever "deliverable" means for
// this project type — each with a status lifecycle and an optional
// crew owner.
export type DeliverableStatus = "not_started" | "in_progress" | "submitted" | "approved" | "delivered";

export const DELIVERABLE_STATUSES: { value: DeliverableStatus; label: string }[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "delivered", label: "Delivered" },
];

export interface DeliverableItem {
  id: string;
  campaignId: string;
  title: string;
  description: string;
  category: string;
  dueDate: string | null;
  status: DeliverableStatus;
  assignedCrewPayeeId: string | null;
  assignedName: string | null;
}

export async function fetchDeliverables(campaignId: string): Promise<DeliverableItem[]> {
  const { data, error } = await supabase
    .from("deliverables")
    .select("id, campaign_id, title, description, category, due_date, status, assigned_crew_payee_id, crew_payees(full_name)")
    .eq("campaign_id", campaignId)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error || !data) return [];
  return (data as any[]).map(r => ({
    id: r.id,
    campaignId: r.campaign_id,
    title: r.title,
    description: r.description ?? "",
    category: r.category ?? "",
    dueDate: r.due_date,
    status: r.status,
    assignedCrewPayeeId: r.assigned_crew_payee_id,
    assignedName: r.crew_payees?.full_name ?? null,
  }));
}

export async function createDeliverable(params: {
  campaignId: string; title: string;
}): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("deliverables")
    .insert({ campaign_id: params.campaignId, title: params.title })
    .select("id")
    .single();
  if (error || !data) return { id: null, error: error?.message ?? "Failed to create deliverable" };
  return { id: data.id, error: null };
}

export async function updateDeliverable(id: string, patch: Partial<{
  title: string; description: string; category: string; dueDate: string | null; assignedCrewPayeeId: string | null;
}>): Promise<{ error: string | null }> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
  if (patch.assignedCrewPayeeId !== undefined) row.assigned_crew_payee_id = patch.assignedCrewPayeeId;
  const { error } = await supabase.from("deliverables").update(row).eq("id", id);
  return { error: error?.message ?? null };
}

// Narrower than updateDeliverable — an assigned crew member who isn't
// admin/producer can only move status via this RPC (see
// update_deliverable_status, 0076), not touch title/assignment/dates.
export async function setDeliverableStatus(id: string, status: DeliverableStatus): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("update_deliverable_status", { p_deliverable_id: id, p_status: status });
  return { error: error?.message ?? null };
}

export async function deleteDeliverable(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("deliverables").delete().eq("id", id);
  return { error: error?.message ?? null };
}
