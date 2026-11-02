import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsForm } from "@/components/profile/settings-form";
import { getAuth, requireViewer } from "@/lib/auth";
import { getProfileById } from "@/lib/data/profiles";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-heading text-4xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 text-muted-foreground">Manage your public profile and account.</p>
      <Suspense fallback={<Skeleton className="mt-10 h-96 w-full rounded-md" />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  const viewer = await requireViewer("/settings");
  const { supabase } = await getAuth();
  const profile = supabase ? await getProfileById(supabase, viewer.id) : null;
  if (!profile) return <p className="mt-10 text-destructive">We couldn&apos;t load your profile.</p>;
  return (
    <>
      <section aria-labelledby="profile-heading" className="mt-10 rounded-md border border-border bg-card/50 p-6 sm:p-8">
        <h2 id="profile-heading" className="mb-6 font-heading text-xl font-semibold">
          Public profile
        </h2>
        <SettingsForm profile={profile} />
      </section>
      <section aria-labelledby="account-heading" className="mt-6 rounded-md border border-border bg-card/50 p-6 sm:p-8">
        <h2 id="account-heading" className="font-heading text-xl font-semibold">
          Account
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{viewer.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Password</dt>
            <dd>
              <Link href="/forgot-password" className="text-primary hover:underline">
                Send a reset link
              </Link>
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
