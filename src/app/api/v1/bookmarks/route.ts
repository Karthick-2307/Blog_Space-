import { z } from "zod";
import { ok } from "@/lib/api";
import { listBookmarkedPosts } from "@/lib/data/posts";
import { route, unauthorized } from "@/lib/route";

const query = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  pageSize: z.coerce.number().int().min(1).max(50).catch(12),
});

/** GET /api/v1/bookmarks — the signed-in user's saved posts. */
export const GET = route(async (req, _ctx: unknown, { supabase, userId }) => {
  if (!userId) return unauthorized();
  const { page, pageSize } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { items, ...meta } = await listBookmarkedPosts(supabase, userId, page, pageSize);
  return ok(items, { meta });
});
