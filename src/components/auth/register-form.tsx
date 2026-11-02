"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { registerSchema } from "@/lib/validation";
import { authErrorMessage, Field, FormAlert, PasswordInput } from "./form-bits";

type Values = z.input<typeof registerSchema>;

export function RegisterForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: Values) {
    setServerError(null);
    if (!configured) return setServerError("The database is not configured yet. See the README.");
    const parsed = registerSchema.parse(values);

    // Check the username first so we can give a precise error.
    const check = await fetch(`/api/v1/profiles/${encodeURIComponent(parsed.username)}`).catch(() => null);
    if (check?.ok) {
      setError("username", { message: "That username is already taken." });
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.email,
      password: parsed.password,
      options: {
        data: { username: parsed.username },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    if (error) return setServerError(authErrorMessage(error.message));

    if (data.session) {
      // Email confirmation is off: the user is signed in already.
      router.replace("/dashboard");
      router.refresh();
      return;
    }
    setSentTo(parsed.email);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="mb-4 grid size-12 place-items-center rounded-full bg-success/15 text-success">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <h2 className="font-heading text-2xl font-semibold">Check your email</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground" role="status">
          If <span className="text-foreground">{sentTo}</span> can be registered, we&apos;ve sent a confirmation
          link to it. Open the link to activate your account, then sign in.
        </p>
        <Link href="/login" className="mt-6 text-sm text-primary hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {serverError ? <FormAlert>{serverError}</FormAlert> : null}

      <Field id="username" label="Username" error={errors.username?.message} hint="3–30 letters, numbers or underscores.">
        <Input
          id="username"
          autoComplete="username"
          className="h-10"
          aria-invalid={Boolean(errors.username)}
          aria-describedby={errors.username ? "username-error" : "username-hint"}
          {...register("username")}
        />
      </Field>

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

      <Field id="password" label="Password" error={errors.password?.message} hint="At least 8 characters, with a letter and a number.">
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : "password-hint"}
          {...register("password")}
        />
      </Field>

      <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmPassword)}
          aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
          {...register("confirmPassword")}
        />
      </Field>

      <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" /> : null}
        Create account
      </Button>
    </form>
  );
}
