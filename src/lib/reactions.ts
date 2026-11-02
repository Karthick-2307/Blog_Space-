import "server-only";
import { fail, ok } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { limited, route, unauthorized } from "@/lib/route";
import { uuidSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Builds POST (add) and DELETE (remove) handlers for likes or bookmarks.
 * Both are idempotent: liking twice is not an error and never duplicates.
 */
export function reactionHandlers(table: "likes" | "bookmarks") {
  const handler = (add: boolean) =>
    route(async (_req, { params }: Ctx, { supabase, userId }) => {
      if (!userId) return unauthorized();
      const id = uuidSchema.safeParse((await params).id);
      if (!id.success) return fail("NOT_FOUND", "Post not found.");

      const rl = limited(`reaction:${userId}`, LIMITS.reaction);
      if (rl) return rl;

      const { data: post, error: postError } = await supabase
        .from("posts")
        .select("id, status, like_count")
        .eq("id", id.data)
        .eq("status", "published")
        .maybeSingle();
      if (postError) throw postError;
      if (!post) return fail("NOT_FOUND", "Post not found.");

      if (add) {
        const { error } = await supabase
          .from(table)
          .upsert({ user_id: userId, post_id: id.data }, { onConflict: "user_id,post_id", ignoreDuplicates: true });
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).delete().eq("user_id", userId).eq("post_id", id.data);
        if (error) throw error;
      }

      const state: Record<string, unknown> = { postId: id.data, [table === "likes" ? "liked" : "bookmarked"]: add };
      if (table === "likes") {
        const { data } = await supabase.from("posts").select("like_count").eq("id", id.data).maybeSingle();
        state.likeCount = data?.like_count ?? post.like_count;
      }
      return ok(state, { status: add ? 201 : 200 });
    });

  return { POST: handler(true), DELETE: handler(false) };
}
