import type { ServerSupabase } from "@/lib/supabase/server";
import type { Comment, Paginated } from "@/types";
import { AUTHOR_SELECT } from "./posts";

export const COMMENT_SELECT = `id, post_id, author_id, parent_id, content, created_at, updated_at, author:profiles!comments_author_id_fkey(${AUTHOR_SELECT})`;

/** Newest first. RLS returns nothing for posts the viewer cannot read. */
export async function listComments(
  supabase: ServerSupabase,
  postId: string,
  page = 1,
  pageSize = 20,
): Promise<Paginated<Comment>> {
  const from = (page - 1) * pageSize;
  const { data, count, error } = await supabase
    .from("comments")
    .select(COMMENT_SELECT, { count: "exact" })
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error && error.code !== "PGRST103") throw error;
  const items = (data ?? []) as unknown as Comment[];
  const total = count ?? items.length;
  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
