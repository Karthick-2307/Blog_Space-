import type { ServerSupabase } from "@/lib/supabase/server";
import type { Category, Tag } from "@/types";

export async function listCategories(supabase: ServerSupabase) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function listTags(supabase: ServerSupabase, limit = 60) {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, slug")
    .order("name")
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Tag[];
}
