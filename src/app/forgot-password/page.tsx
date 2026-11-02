import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/form-bits";
import { ForgotPasswordForm } from "@/components/auth/password-forms";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      subtitle={
        <>
          Enter your email and we&apos;ll send you a reset link.{" "}
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm configured={isSupabaseConfigured()} />
    </AuthShell>
  );
}
