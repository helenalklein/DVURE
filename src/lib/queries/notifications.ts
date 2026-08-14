import { supabase } from "../supabaseClient";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  campaignId: string | null;
  createdAt: string;
  unread: boolean;
}

export async function fetchNotifications(orgId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, campaign_id, created_at, read_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data) return [];
  return data.map((n: any) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    campaignId: n.campaign_id,
    createdAt: n.created_at,
    unread: n.read_at == null,
  }));
}

export async function markNotificationRead(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function markAllNotificationsRead(orgId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("org_id", orgId).is("read_at", null);
  return { error: error?.message ?? null };
}
