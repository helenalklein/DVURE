import { supabase } from "../supabaseClient";

// The bridge between mock numeric campaign ids and real uuid campaigns.
// RLS scopes this automatically: a brand only resolves campaigns it owns,
// an agency only resolves campaigns it's distributed on — an org with no
// real relationship to `name` gets zero rows back, not an error, which is
// exactly the "fall through to mock data" signal callers rely on.
export async function findCampaignIdByName(name: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("id")
    .eq("name", name)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0].id as string;
}
