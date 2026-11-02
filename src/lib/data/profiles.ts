import type { ServerSupabase } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export const PROFILE_SELECT = "id, username, display_name, bio, avatar_url, website_url, created_at";

export async function getProfileByUsername(supabase: ServerSupabase, username: string) {
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function getProfileById(supabase: ServerSupabase, id: string) {
  const { data, error } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}
