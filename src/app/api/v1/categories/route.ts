import { ok } from "@/lib/api";
import { listCategories } from "@/lib/data/taxonomy";
import { route } from "@/lib/route";

/** GET /api/v1/categories — all categories. */
export const GET = route(async (_req, _ctx: unknown, { supabase }) => ok(await listCategories(supabase)));
