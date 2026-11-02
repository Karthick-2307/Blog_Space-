import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell, FormAlert } from "@/components/auth/form-bits";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you haven't used before.">
      <Suspense fallback={<div className="h-48" />}>
        <Gate />
      </Suspense>
    </AuthShell>
  );
}

/** The reset email link signs the user in. Without that session, the link has expired. */
async function Gate() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <div className="space-y-4">
        <FormAlert>This reset link is invalid or has expired.</FormAlert>
        <Link href="/forgot-password" className="text-sm text-primary hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm />;
}
