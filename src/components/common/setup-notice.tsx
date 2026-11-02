import { DatabaseZap } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";

/** Shown only while the Supabase environment variables are missing. */
export function SetupNotice() {
  if (isSupabaseConfigured()) return null;
  return (
    <div role="status" className="border-b border-amber-500/20 bg-amber-500/10">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-3 text-sm sm:px-6">
        <DatabaseZap className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
        <p className="min-w-0 text-amber-900 [overflow-wrap:anywhere] dark:text-amber-100">
          <strong className="font-medium">Database not connected.</strong> Add{" "}
          <code className="rounded bg-black/10 px-1 dark:bg-white/10">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-black/10 px-1 dark:bg-white/10">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>{" "}
          to <code className="rounded bg-black/10 px-1 dark:bg-white/10">.env.local</code>, then rebuild. Step-by-step guide: SUPABASE_SETUP.md (or the README).
        </p>
      </div>
    </div>
  );
}
