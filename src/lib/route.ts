import "server-only";
import { dbError, fail, PayloadTooLargeError } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";

type Ctx = { supabase: ServerSupabase; userId: string | null };

/** Wraps a route handler: config check, verified identity, and safe errors. */
export function route<C>(fn: (req: Request, ctx: C, auth: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    if (!isSupabaseConfigured()) {
      return fail("SERVICE_UNAVAILABLE", "The database is not configured yet.");
    }
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getClaims();
      const sub = !error ? data?.claims?.sub : undefined;
      return await fn(req, ctx, { supabase, userId: typeof sub === "string" ? sub : null });
    } catch (err) {
      if (err instanceof PayloadTooLargeError) return fail("PAYLOAD_TOO_LARGE", "Request body is too large.");
      return dbError(err as { code?: string }, `${req.method} ${new URL(req.url).pathname}`);
    }
  };
}

export function unauthorized() {
  return fail("UNAUTHORIZED", "You need to sign in to do that.");
}

/** Returns a 429 response when the caller is over the limit, otherwise null. */
export function limited(key: string, rule: { limit: number; windowMs: number }) {
  const res = rateLimit(key, rule.limit, rule.windowMs);
  if (res.allowed) return null;
  return fail("RATE_LIMITED", "Too many requests. Please slow down.", undefined, {
    "Retry-After": String(res.retryAfterSeconds),
  });
}
