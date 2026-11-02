import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  email: string | null;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Verified identity of the current request (JWT checked by getClaims).
 * Returns nulls when signed out or when Supabase is not configured.
 */
export async function getAuth(): Promise<{ supabase: ServerSupabase | null; userId: string | null }> {
  if (!isSupabaseConfigured()) return { supabase: null, userId: null };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = !error ? data?.claims?.sub : undefined;
  return { supabase, userId: typeof sub === "string" ? sub : null };
}

/** The signed-in user's profile, cached for the duration of one request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const { supabase, userId } = await getAuth();
  if (!supabase || !userId) return null;
  const [{ data: profile }, { data: claims }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle(),
    supabase.auth.getClaims(),
  ]);
  if (!profile) return null;
  const email = claims?.claims?.email;
  return { ...profile, email: typeof email === "string" ? email : null } as Viewer;
});

/** For protected pages: returns the viewer or redirects to login. */
export async function requireViewer(nextPath: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return viewer;
}
