import { fail, noContent, ok, readJson, validationError } from "@/lib/api";
import { COMMENT_SELECT } from "@/lib/data/comments";
import { LIMITS } from "@/lib/rate-limit";
import { limited, route, unauthorized } from "@/lib/route";
import { commentUpdateSchema, uuidSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => fail("NOT_FOUND", "Comment not found.");

/** PATCH /api/v1/comments/:id — comment author only. */
export const PATCH = route(async (req, { params }: Ctx, { supabase, userId }) => {
  if (!userId) return unauthorized();
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return notFound();

  const rl = limited(`comment:${userId}`, LIMITS.comment);
  if (rl) return rl;

  const parsed = commentUpdateSchema.safeParse(await readJson(req, 20_000));
  if (!parsed.success) return validationError(parsed.error);

  const { data: existing, error: readError } = await supabase
    .from("comments")
    .select("id, author_id")
    .eq("id", id.data)
    .maybeSingle();
  if (readError) throw readError;
  if (!existing) return notFound();
  if (existing.author_id !== userId) return fail("FORBIDDEN", "You can only edit your own comments.");

  const { data, error } = await supabase
    .from("comments")
    .update({ content: parsed.data.content })
    .eq("id", id.data)
    .select(COMMENT_SELECT)
    .maybeSingle();
  if (error) throw error;
  if (!data) return fail("FORBIDDEN", "You can only edit your own comments.");
  return ok(data);
});

/** DELETE /api/v1/comments/:id — comment author (or admin) only. */
export const DELETE = route(async (_req, { params }: Ctx, { supabase, userId }) => {
  if (!userId) return unauthorized();
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return notFound();

  const { data: existing, error: readError } = await supabase
    .from("comments")
    .select("id")
    .eq("id", id.data)
    .maybeSingle();
  if (readError) throw readError;
  if (!existing) return notFound();

  const { data, error } = await supabase.from("comments").delete().eq("id", id.data).select("id");
  if (error) throw error;
  if (!data?.length) return fail("FORBIDDEN", "You can only delete your own comments.");
  return noContent();
});
