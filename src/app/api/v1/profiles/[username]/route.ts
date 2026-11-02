import { fail, ok } from "@/lib/api";
import { getProfileByUsername } from "@/lib/data/profiles";
import { route } from "@/lib/route";

type Ctx = { params: Promise<{ username: string }> };

/** GET /api/v1/profiles/:username — public profile information. */
export const GET = route(async (_req, { params }: Ctx, { supabase }) => {
  const { username } = await params;
  const profile = await getProfileByUsername(supabase, decodeURIComponent(username));
  if (!profile) return fail("NOT_FOUND", "Profile not found.");

  const { count } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", profile.id)
    .eq("status", "published");

  return ok({ ...profile, postCount: count ?? 0 });
});
