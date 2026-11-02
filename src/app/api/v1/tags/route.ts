import { ok } from "@/lib/api";
import { listTags } from "@/lib/data/taxonomy";
import { route } from "@/lib/route";

/** GET /api/v1/tags — tags in alphabetical order (max 60). */
export const GET = route(async (_req, _ctx: unknown, { supabase }) => ok(await listTags(supabase)));
