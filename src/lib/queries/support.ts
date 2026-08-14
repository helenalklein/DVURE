import { supabase } from "../supabaseClient";

export type SupportTicketCategory = "delete_organization" | "billing" | "bug" | "other";

export async function submitSupportTicket(
  category: SupportTicketCategory,
  subject: string,
  message: string
): Promise<{ ticketId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("submit_support_ticket", {
    p_category: category,
    p_subject: subject,
    p_message: message,
  });
  if (error) return { ticketId: null, error: error.message };
  return { ticketId: data as string, error: null };
}
