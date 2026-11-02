import { ok, readJson, fail, validationError } from "@/lib/api";
import { listPublishedPosts, getPostById } from "@/lib/data/posts";
import { newPostRow, publishProblems, syncPostTags } from "@/lib/data/post-mutations";
import { LIMITS } from "@/lib/rate-limit";
import { limited, route, unauthorized } from "@/lib/route";
import { listQuerySchema, postInputSchema } from "@/lib/validation";

/** GET /api/v1/posts — public list of published posts. */
export const GET = route(async (req, _ctx: unknown, { supabase }) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const query = listQuerySchema.parse(params);
  const result = await listPublishedPosts(supabase, query);
  if (result.unknownFilter) return fail("NOT_FOUND", "Unknown category or tag.");
  const { items, ...meta } = result;
  return ok(items, {
    meta: {
      page: meta.page,
      pageSize: meta.pageSize,
      total: meta.total,
      totalPages: meta.totalPages,
    },
  });
});

/** POST /api/v1/posts — create a post for the signed-in user. */
export const POST = route(async (req, _ctx: unknown, { supabase, userId }) => {
  if (!userId) return unauthorized();
  const rl = limited(`post:${userId}`, LIMITS.postWrite);
  if (rl) return rl;

  const parsed = postInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);

  const row = newPostRow(userId, parsed.data);
  const problem = publishProblems(row);
  if (problem) return fail("VALIDATION_ERROR", problem, { contentHtml: [problem] });

  if (parsed.data.categoryId) {
    const { data: cat } = await supabase.from("categories").select("id").eq("id", parsed.data.categoryId).maybeSingle();
    if (!cat) return fail("VALIDATION_ERROR", "Unknown category.", { categoryId: ["Unknown category."] });
  }

  const { data, error } = await supabase.from("posts").insert(row).select("id").single();
  if (error) throw error;

  await syncPostTags(supabase, data.id, parsed.data.tags);
  const post = await getPostById(supabase, data.id);
  return ok(post, { status: 201 });
});
