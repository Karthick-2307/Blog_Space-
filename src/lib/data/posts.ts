import type { ServerSupabase } from "@/lib/supabase/server";
import type { ListQuery } from "@/lib/validation";
import type { Category, Paginated, PostDetail, PostSummary, Tag } from "@/types";

export const AUTHOR_SELECT = "id, username, display_name, avatar_url";

export const SUMMARY_SELECT = `id, title, slug, excerpt, cover_image_url, status, published_at, created_at, updated_at, reading_time, like_count, comment_count, author:profiles!posts_author_id_fkey(${AUTHOR_SELECT}), category:categories(name, slug)`;

const DETAIL_SELECT = `${SUMMARY_SELECT}, author_id, category_id, content_json, content_html, post_tags(tags(id, name, slug))`;

type RawDetail = Omit<PostDetail, "tags"> & { post_tags: { tags: Tag | null }[] | null };

function toDetail(row: RawDetail): PostDetail {
  const { post_tags, ...rest } = row;
  return {
    ...rest,
    tags: (post_tags ?? []).map((pt) => pt.tags).filter((t): t is Tag => Boolean(t)),
  };
}

export type PostListResult = Paginated<PostSummary> & {
  category: Category | null;
  tag: Tag | null;
  /** True when a category or tag slug was given but does not exist. */
  unknownFilter: boolean;
};

/** Published posts with search, category/tag filters, sorting and pagination. */
export async function listPublishedPosts(
  supabase: ServerSupabase,
  query: ListQuery,
): Promise<PostListResult> {
  const { page, pageSize, q, sort } = query;
  const empty = (extra: Partial<PostListResult> = {}): PostListResult => ({
    items: [], page, pageSize, total: 0, totalPages: 0, category: null, tag: null, unknownFilter: false, ...extra,
  });

  const [categoryRes, tagRes] = await Promise.all([
    query.category
      ? supabase.from("categories").select("id, name, slug, description").eq("slug", query.category).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    query.tag
      ? supabase.from("tags").select("id, name, slug").eq("slug", query.tag).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (categoryRes.error) throw categoryRes.error;
  if (tagRes.error) throw tagRes.error;
  const category = categoryRes.data as Category | null;
  const tag = tagRes.data as Tag | null;
  if ((query.category && !category) || (query.tag && !tag)) {
    return empty({ category, tag, unknownFilter: true });
  }

  const select = tag ? `${SUMMARY_SELECT}, tag_filter:post_tags!inner(tag_id)` : SUMMARY_SELECT;
  let builder = supabase.from("posts").select(select, { count: "exact" }).eq("status", "published");

  if (category) builder = builder.eq("category_id", category.id);
  if (tag) builder = builder.eq("tag_filter.tag_id", tag.id);
  if (q) builder = builder.textSearch("search", q, { type: "websearch", config: "english" });

  builder =
    sort === "popular"
      ? builder
          .order("like_count", { ascending: false })
          .order("comment_count", { ascending: false })
          .order("published_at", { ascending: false })
      : builder.order("published_at", { ascending: false });

  const from = (page - 1) * pageSize;
  const { data, count, error } = await builder.range(from, from + pageSize - 1);

  // PostgREST returns PGRST103 when the page is past the end.
  if (error?.code === "PGRST103") return empty({ category, tag, total: count ?? 0 });
  if (error) throw error;

  const items = ((data ?? []) as unknown as (PostSummary & { tag_filter?: unknown })[]).map((row) => {
    const post = { ...row };
    delete post.tag_filter;
    return post as PostSummary;
  });
  const total = count ?? items.length;
  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize), category, tag, unknownFilter: false };
}

export async function getPublishedPostBySlug(supabase: ServerSupabase, slug: string) {
  const { data, error } = await supabase
    .from("posts")
    .select(DETAIL_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return data ? toDetail(data as unknown as RawDetail) : null;
}

/** Any post the current user may read (RLS hides other people's drafts). */
export async function getPostById(supabase: ServerSupabase, id: string) {
  const { data, error } = await supabase.from("posts").select(DETAIL_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toDetail(data as unknown as RawDetail) : null;
}

export async function getRelatedPosts(supabase: ServerSupabase, post: PostDetail, limit = 3) {
  let builder = supabase
    .from("posts")
    .select(SUMMARY_SELECT)
    .eq("status", "published")
    .neq("id", post.id);
  if (post.category_id) builder = builder.eq("category_id", post.category_id);
  const { data, error } = await builder
    .order("like_count", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as PostSummary[];
}

export async function getHomeFeed(supabase: ServerSupabase) {
  const [latest, popular] = await Promise.all([
    supabase
      .from("posts")
      .select(SUMMARY_SELECT)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(7),
    supabase
      .from("posts")
      .select(SUMMARY_SELECT)
      .eq("status", "published")
      .gt("like_count", 0)
      .order("like_count", { ascending: false })
      .order("comment_count", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(5),
  ]);
  if (latest.error) throw latest.error;
  if (popular.error) throw popular.error;
  return {
    latest: (latest.data ?? []) as unknown as PostSummary[],
    popular: (popular.data ?? []) as unknown as PostSummary[],
  };
}

export async function listAuthorPosts(
  supabase: ServerSupabase,
  authorId: string,
  opts: { status?: "draft" | "published"; limit?: number } = {},
) {
  let builder = supabase.from("posts").select(SUMMARY_SELECT).eq("author_id", authorId);
  if (opts.status) builder = builder.eq("status", opts.status);
  const { data, error } = await builder
    .order("updated_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (error) throw error;
  return (data ?? []) as unknown as PostSummary[];
}

export async function getViewerReactions(supabase: ServerSupabase, userId: string, postId: string) {
  const [like, bookmark] = await Promise.all([
    supabase.from("likes").select("post_id").eq("user_id", userId).eq("post_id", postId).maybeSingle(),
    supabase.from("bookmarks").select("post_id").eq("user_id", userId).eq("post_id", postId).maybeSingle(),
  ]);
  return { liked: Boolean(like.data), bookmarked: Boolean(bookmark.data) };
}

export async function listBookmarkedPosts(
  supabase: ServerSupabase,
  userId: string,
  page = 1,
  pageSize = 12,
): Promise<Paginated<PostSummary & { bookmarked_at: string }>> {
  const from = (page - 1) * pageSize;
  const { data, count, error } = await supabase
    .from("bookmarks")
    .select(`created_at, post:posts(${SUMMARY_SELECT})`, { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error && error.code !== "PGRST103") throw error;
  const rows = (data ?? []) as unknown as { created_at: string; post: PostSummary | null }[];
  // A bookmarked post that was unpublished is hidden by RLS and comes back null.
  const items = rows
    .filter((r) => r.post && r.post.status === "published")
    .map((r) => ({ ...(r.post as PostSummary), bookmarked_at: r.created_at }));
  const total = count ?? items.length;
  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
