import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/form-bits";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { RegisterForm } from "@/components/auth/register-form";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create an account"
      subtitle={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <RegisterForm configured={isSupabaseConfigured()} />
    </AuthShell>
  );
}
