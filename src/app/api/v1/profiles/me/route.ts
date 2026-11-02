import { fail, ok, readJson, validationError } from "@/lib/api";
import { getProfileById, PROFILE_SELECT } from "@/lib/data/profiles";
import { LIMITS } from "@/lib/rate-limit";
import { limited, route, unauthorized } from "@/lib/route";
import { profileUpdateSchema } from "@/lib/validation";

/** GET /api/v1/profiles/me — the signed-in user's profile. */
export const GET = route(async (_req, _ctx: unknown, { supabase, userId }) => {
  if (!userId) return unauthorized();
  const profile = await getProfileById(supabase, userId);
  return profile ? ok(profile) : fail("NOT_FOUND", "Profile not found.");
});

/**
 * PATCH /api/v1/profiles/me — update permitted fields only.
 * Unknown fields (e.g. "role") are rejected; the DB also blocks writes to role.
 */
export const PATCH = route(async (req, _ctx: unknown, { supabase, userId }) => {
  if (!userId) return unauthorized();
  const rl = limited(`profile:${userId}`, LIMITS.profile);
  if (rl) return rl;

  const parsed = profileUpdateSchema.safeParse(await readJson(req, 10_000));
  if (!parsed.success) return validationError(parsed.error);

  const input = parsed.data;
  const row: Record<string, unknown> = {};
  if (input.username !== undefined) row.username = input.username;
  if (input.displayName !== undefined) row.display_name = input.displayName || null;
  if (input.bio !== undefined) row.bio = input.bio || null;
  if (input.websiteUrl !== undefined) row.website_url = input.websiteUrl || null;
  if (input.avatarUrl !== undefined) row.avatar_url = input.avatarUrl || null;
  if (!Object.keys(row).length) return fail("VALIDATION_ERROR", "Nothing to update.");

  const { data, error } = await supabase
    .from("profiles")
    .update(row)
    .eq("id", userId)
    .select(PROFILE_SELECT)
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return fail("CONFLICT", "That username is already taken.", { username: ["That username is already taken."] });
    }
    throw error;
  }
  return data ? ok(data) : fail("NOT_FOUND", "Profile not found.");
});
