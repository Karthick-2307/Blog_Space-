"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/auth/form-bits";
import { UserAvatar } from "@/components/common/user-avatar";
import { api, ApiRequestError, uploadImage } from "@/lib/http";
import { usernameSchema } from "@/lib/validation";
import type { Profile } from "@/types";

const schema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().max(60, "Display name is too long."),
  bio: z.string().trim().max(300, "Bio must be at most 300 characters."),
  websiteUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https?:\/\/\S+\.\S+/.test(v), "Enter a full URL starting with https://"),
});
type Values = z.input<typeof schema>;

export function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    setError,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: profile.username,
      displayName: profile.display_name ?? "",
      bio: profile.bio ?? "",
      websiteUrl: profile.website_url ?? "",
    },
  });
  const bio = useWatch({ control, name: "bio" }) ?? "";

  async function onAvatar(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, "avatar");
      await api("/api/v1/profiles/me", { method: "PATCH", body: { avatarUrl: url } });
      setAvatarUrl(url);
      toast.success("Avatar updated.");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onSubmit(values: Values) {
    try {
      const { data } = await api<Profile>("/api/v1/profiles/me", {
        method: "PATCH",
        body: {
          username: values.username.trim(),
          displayName: values.displayName.trim() || null,
          bio: values.bio.trim() || null,
          websiteUrl: values.websiteUrl.trim() || null,
        },
      });
      reset({
        username: data.username,
        displayName: data.display_name ?? "",
        bio: data.bio ?? "",
        websiteUrl: data.website_url ?? "",
      });
      toast.success("Profile saved.");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiRequestError && err.details) {
        const map: Record<string, keyof Values> = {
          username: "username",
          displayName: "displayName",
          bio: "bio",
          websiteUrl: "websiteUrl",
        };
        for (const [k, msgs] of Object.entries(err.details)) {
          if (map[k]) setError(map[k], { message: msgs[0] });
        }
      }
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="avatar-heading" className="flex items-center gap-5">
        <div className="relative">
          <UserAvatar
            user={{ username: profile.username, display_name: profile.display_name, avatar_url: avatarUrl }}
            size="lg"
            className="size-20 text-2xl data-[size=lg]:size-20"
          />
          {uploading ? (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-background/70">
              <Loader2 className="size-5 animate-spin" aria-label="Uploading" />
            </span>
          ) : null}
        </div>
        <div>
          <h2 id="avatar-heading" className="font-medium">
            Profile photo
          </h2>
          <p className="text-sm text-muted-foreground">JPEG, PNG, WebP or GIF, up to 5 MB.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 gap-1.5"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Camera /> Upload new photo
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            tabIndex={-1}
            aria-label="Upload profile photo"
            onChange={(e) => onAvatar(e.target.files?.[0])}
          />
        </div>
      </section>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Field id="username" label="Username" error={errors.username?.message} hint="Your profile lives at /profile/username.">
          <Input id="username" className="h-10" aria-invalid={Boolean(errors.username)} {...register("username")} />
        </Field>
        <Field id="displayName" label="Display name" error={errors.displayName?.message}>
          <Input id="displayName" className="h-10" maxLength={60} aria-invalid={Boolean(errors.displayName)} {...register("displayName")} />
        </Field>
        <Field id="bio" label="Bio" error={errors.bio?.message} hint={`${bio.length}/300`}>
          <Textarea id="bio" rows={4} maxLength={300} aria-invalid={Boolean(errors.bio)} {...register("bio")} />
        </Field>
        <Field id="websiteUrl" label="Website" error={errors.websiteUrl?.message}>
          <Input
            id="websiteUrl"
            type="url"
            placeholder="https://"
            className="h-10"
            aria-invalid={Boolean(errors.websiteUrl)}
            {...register("websiteUrl")}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
