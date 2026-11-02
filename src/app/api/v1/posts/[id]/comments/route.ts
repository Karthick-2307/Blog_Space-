import { z } from "zod";
import { fail, ok, readJson, validationError } from "@/lib/api";
import { COMMENT_SELECT, listComments } from "@/lib/data/comments";
import { LIMITS } from "@/lib/rate-limit";
import { limited, route, unauthorized } from "@/lib/route";
import type { ServerSupabase } from "@/lib/supabase/server";
import { commentInputSchema, uuidSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const pageQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  pageSize: z.coerce.number().int().min(1).max(50).catch(20),
});

async function visiblePost(supabase: ServerSupabase, id: string) {
  const { data, error } = await supabase.from("posts").select("id, status").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as { id: string; status: string } | null;
}

/** GET /api/v1/posts/:id/comments — paginated, newest first. */
export const GET = route(async (req, { params }: Ctx, { supabase }) => {
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return fail("NOT_FOUND", "Post not found.");
  if (!(await visiblePost(supabase, id.data))) return fail("NOT_FOUND", "Post not found.");

  const { page, pageSize } = pageQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { items, ...meta } = await listComments(supabase, id.data, page, pageSize);
  return ok(items, { meta });
});

/** POST /api/v1/posts/:id/comments — signed-in users, published posts only. */
export const POST = route(async (req, { params }: Ctx, { supabase, userId }) => {
  if (!userId) return unauthorized();
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return fail("NOT_FOUND", "Post not found.");

  const rl = limited(`comment:${userId}`, LIMITS.comment);
  if (rl) return rl;

  const parsed = commentInputSchema.safeParse(await readJson(req, 20_000));
  if (!parsed.success) return validationError(parsed.error);

  const post = await visiblePost(supabase, id.data);
  if (!post || post.status !== "published") return fail("NOT_FOUND", "Post not found.");

  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_id: id.data,
      author_id: userId,
      parent_id: parsed.data.parentId ?? null,
      content: parsed.data.content,
    })
    .select(COMMENT_SELECT)
    .single();
  if (error) throw error;
  return ok(data, { status: 201 });
});
