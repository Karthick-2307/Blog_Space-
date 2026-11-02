import type { ServerSupabase } from "@/lib/supabase/server";
import { postSlug, readingTime, slugify } from "@/lib/format";
import { htmlToText, sanitizeArticleHtml } from "@/lib/sanitize";
import type { PostInput, PostUpdate } from "@/lib/validation";

type Row = Record<string, unknown>;

/** Builds the DB row from validated input. HTML is sanitized here, server-side. */
export function buildPostRow(input: PostUpdate): Row {
  const row: Row = {};
  if (input.title !== undefined) row.title = input.title;
  if (input.slug !== undefined) row.slug = input.slug;
  if (input.excerpt !== undefined) row.excerpt = input.excerpt || null;
  if (input.coverImageUrl !== undefined) row.cover_image_url = input.coverImageUrl || null;
  if (input.categoryId !== undefined) row.category_id = input.categoryId || null;
  if (input.status !== undefined) row.status = input.status;
  if (input.contentJson !== undefined) row.content_json = input.contentJson;
  if (input.contentHtml !== undefined) {
    const html = sanitizeArticleHtml(input.contentHtml);
    const text = htmlToText(html);
    row.content_html = html;
    row.content_text = text.slice(0, 100_000);
    row.reading_time = Math.min(600, readingTime(text));
    // Fall back to the first sentences when no excerpt was provided.
    if (!input.excerpt && input.excerpt !== undefined) {
      row.excerpt = text ? text.slice(0, 200).replace(/\s+\S*$/, "") + (text.length > 200 ? "…" : "") : null;
    }
  }
  return row;
}

/** Publishing needs real content, not just a title. */
export function publishProblems(row: { status?: unknown; content_text?: unknown }): string | null {
  if (row.status !== "published") return null;
  if (typeof row.content_text === "string" && row.content_text.trim().length < 20) {
    return "Write at least a few sentences before publishing.";
  }
  return null;
}

export function normalizeTags(names: string[]): { name: string; slug: string }[] {
  const seen = new Map<string, { name: string; slug: string }>();
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, " ");
    const slug = slugify(name, 40);
    if (slug && !seen.has(slug)) seen.set(slug, { name, slug });
  }
  return [...seen.values()].slice(0, 5);
}

/** Replaces a post's tags. Creates missing tags. */
export async function syncPostTags(supabase: ServerSupabase, postId: string, names: string[]) {
  const tags = normalizeTags(names);
  const del = await supabase.from("post_tags").delete().eq("post_id", postId);
  if (del.error) throw del.error;
  if (!tags.length) return;

  const up = await supabase.from("tags").upsert(tags, { onConflict: "slug", ignoreDuplicates: true });
  if (up.error) throw up.error;

  const { data, error } = await supabase.from("tags").select("id, slug").in("slug", tags.map((t) => t.slug));
  if (error) throw error;

  const ins = await supabase
    .from("post_tags")
    .insert((data ?? []).map((t) => ({ post_id: postId, tag_id: t.id })));
  if (ins.error) throw ins.error;
}

export function newPostRow(userId: string, input: PostInput): Row {
  const row = buildPostRow({ ...input, excerpt: input.excerpt ?? null });
  row.author_id = userId;
  row.slug = input.slug ? input.slug : postSlug(input.title);
  return row;
}
