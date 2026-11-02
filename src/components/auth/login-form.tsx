"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeNextPath } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validation";
import { authErrorMessage, Field, FormAlert, PasswordInput } from "./form-bits";

type Values = z.input<typeof loginSchema>;

export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"), "/dashboard");
  const linkError = params.get("error") === "link";
  const [serverError, setServerError] = useState<string | null>(
    linkError ? "That link is invalid or has expired. Please try again." : null,
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  async function onSubmit(values: Values) {
    setServerError(null);
    if (!configured) return setServerError("The database is not configured yet. See the README.");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email.trim().toLowerCase(),
      password: values.password,
    });
    if (error) return setServerError(authErrorMessage(error.message));
    router.replace(next);
    router.refresh();
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

      <Field
        id="password"
        label="Password"
        error={errors.password?.message}
        aside={
          <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
            Forgot password?
          </Link>
        }
      >
        <PasswordInput
          id="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
      </Field>

      <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" /> : null}
        Sign in
      </Button>
    </form>
  );
}
