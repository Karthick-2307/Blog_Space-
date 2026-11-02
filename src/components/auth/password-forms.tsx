"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation";
import { authErrorMessage, Field, FormAlert, PasswordInput } from "./form-bits";

export function ForgotPasswordForm({ configured }: { configured: boolean }) {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.input<typeof forgotPasswordSchema>) {
    setServerError(null);
    if (!configured) return setServerError("The database is not configured yet. See the README.");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(values.email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    // Only surface rate-limit/network problems; never reveal whether the account exists.
    if (error && /rate|fetch|network/i.test(error.message)) return setServerError(authErrorMessage(error.message));
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">
          If an account exists for that email, a password reset link is on its way. The link expires after a
          short time.
        </FormAlert>
        <Link href="/login" className="inline-block text-sm text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {serverError ? <FormAlert>{serverError}</FormAlert> : null}
      <Field id="email" label="Email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          className="h-10"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
      </Field>
      <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" /> : null}
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: z.input<typeof resetPasswordSchema>) {
    setServerError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) return setServerError(authErrorMessage(error.message));
    toast.success("Password updated.");
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {serverError ? <FormAlert>{serverError}</FormAlert> : null}
      <Field id="password" label="New password" error={errors.password?.message} hint="At least 8 characters, with a letter and a number.">
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
      </Field>
      <Field id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmPassword)}
          {...register("confirmPassword")}
        />
      </Field>
      <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" /> : null}
        Update password
      </Button>
    </form>
  );
}
