import { fail, noContent, ok, readJson, validationError } from "@/lib/api";
import { getPostById } from "@/lib/data/posts";
import { buildPostRow, publishProblems, syncPostTags } from "@/lib/data/post-mutations";
import { LIMITS } from "@/lib/rate-limit";
import { htmlToText } from "@/lib/sanitize";
import { limited, route, unauthorized } from "@/lib/route";
import { postUpdateSchema, uuidSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => fail("NOT_FOUND", "Post not found.");

/** GET /api/v1/posts/:id — a published post, or the author's own draft. */
export const GET = route(async (_req, { params }: Ctx, { supabase }) => {
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return notFound();
  // RLS only returns drafts to their author (or an admin).
  const post = await getPostById(supabase, id.data);
  return post ? ok(post) : notFound();
});

/** PATCH /api/v1/posts/:id — author-only update. */
export const PATCH = route(async (req, { params }: Ctx, { supabase, userId }) => {
  if (!userId) return unauthorized();
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return notFound();

  const rl = limited(`post:${userId}`, LIMITS.postWrite);
  if (rl) return rl;

  const parsed = postUpdateSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);

  const existing = await getPostById(supabase, id.data);
  if (!existing) return notFound();
  if (existing.author_id !== userId) return fail("FORBIDDEN", "You can only edit your own posts.");

  const row = buildPostRow(parsed.data);
  if ((row.status ?? existing.status) === "published") {
    const text =
      typeof row.content_text === "string" ? row.content_text : htmlToText(existing.content_html);
    const problem = publishProblems({ status: "published", content_text: text });
    if (problem) return fail("VALIDATION_ERROR", problem, { contentHtml: [problem] });
  }

  if (Object.keys(row).length > 0) {
    const { data, error } = await supabase.from("posts").update(row).eq("id", id.data).select("id");
    if (error) throw error;
    if (!data?.length) return fail("FORBIDDEN", "You can only edit your own posts.");
  }
  if (parsed.data.tags) await syncPostTags(supabase, id.data, parsed.data.tags);

  return ok(await getPostById(supabase, id.data));
});

/** DELETE /api/v1/posts/:id — author (or admin) only. */
export const DELETE = route(async (_req, { params }: Ctx, { supabase, userId }) => {
  if (!userId) return unauthorized();
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return notFound();

  const existing = await getPostById(supabase, id.data);
  if (!existing) return notFound();

  // RLS decides (author or admin); zero deleted rows means not allowed.
  const { data, error } = await supabase.from("posts").delete().eq("id", id.data).select("id");
  if (error) throw error;
  if (!data?.length) return fail("FORBIDDEN", "You can only delete your own posts.");
  return noContent();
});
