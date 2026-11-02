import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Anonymous client with no session. It can only see public data (RLS treats it
 * as a signed-out visitor), so it is safe for metadata and shared content.
 */
export function createPublicClient() {
  if (!isSupabaseConfigured()) return null;
  return createSupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
