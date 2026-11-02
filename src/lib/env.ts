// Accept URLs pasted with a trailing "/" or "/rest/v1/".
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .trim()
  .replace(/\/rest\/v1\/?$/, "")
  .replace(/\/+$/, "");

const RAW_KEY = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

/**
 * Secret / service-role keys bypass Row Level Security and must never reach
 * the browser. If one is put in this public variable, refuse to use it.
 */
function isSecretKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  if (key.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return payload?.role === "service_role";
    } catch {
      return false;
    }
  }
  return false;
}

export const SECRET_KEY_MISUSED = isSecretKey(RAW_KEY);
export const SUPABASE_PUBLISHABLE_KEY = SECRET_KEY_MISUSED ? "" : RAW_KEY;

if (SECRET_KEY_MISUSED && typeof window === "undefined") {
  console.error(
    "[BlogSpace] NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contains a SECRET key. It has been ignored. " +
      "Use the publishable key (sb_publishable_…) and rotate the secret key in Supabase.",
  );
}

/** True when the Supabase project URL and a (non-secret) publishable key are set. */
export function isSupabaseConfigured(): boolean {
  return (
    SUPABASE_URL.startsWith("http") &&
    SUPABASE_PUBLISHABLE_KEY.length > 20 &&
    !SUPABASE_URL.includes("your-project")
  );
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
