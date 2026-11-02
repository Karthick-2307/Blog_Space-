import { z } from "zod";

export const uuidSchema = z.uuid({ message: "Invalid id." });

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(30, "Username must be at most 30 characters.")
  .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers and underscores.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be at most 72 characters.")
  .regex(/[a-zA-Z]/, "Password must contain a letter.")
  .regex(/[0-9]/, "Password must contain a number.");

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

const httpsUrl = z
  .url({ protocol: /^https$/, message: "Must be an https:// URL." })
  .max(500);

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug may contain lowercase letters, numbers and dashes.");

const tagNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(30, "Tags must be at most 30 characters.")
  .regex(/[a-zA-Z0-9]/, "Tags must contain a letter or number.");

/** Post fields without defaults (used for partial updates). */
const postFields = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200, "Title is too long."),
  slug: slugSchema.optional(),
  excerpt: z.string().trim().max(300, "Excerpt must be at most 300 characters.").optional().nullable(),
  contentJson: z.record(z.string(), z.unknown()),
  contentHtml: z.string().max(200_000, "Article is too long."),
  coverImageUrl: httpsUrl.optional().nullable(),
  categoryId: uuidSchema.optional().nullable(),
  tags: z.array(tagNameSchema).max(5, "Use at most 5 tags."),
  status: z.enum(["draft", "published"]),
});

export const postInputSchema = postFields.extend({
  contentJson: postFields.shape.contentJson.default({}),
  tags: postFields.shape.tags.default([]),
  status: postFields.shape.status.default("draft"),
});
export type PostInput = z.infer<typeof postInputSchema>;

// No defaults here: a PATCH must only change the fields it sends.
export const postUpdateSchema = postFields.partial().refine(
  (v) => Object.keys(v).length > 0,
  "Provide at least one field to update.",
);
export type PostUpdate = z.infer<typeof postUpdateSchema>;

export const commentInputSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty.")
    .max(2000, "Comment must be at most 2000 characters."),
  parentId: uuidSchema.optional().nullable(),
});

export const commentUpdateSchema = commentInputSchema.pick({ content: true });

export const profileUpdateSchema = z
  .object({
    username: usernameSchema,
    displayName: z.string().trim().max(60, "Display name is too long.").nullable(),
    bio: z.string().trim().max(300, "Bio must be at most 300 characters.").nullable(),
    websiteUrl: z
      .url({ protocol: /^https?$/, message: "Enter a valid http(s) URL." })
      .max(300)
      .nullable(),
    avatarUrl: httpsUrl.nullable(),
  })
  .partial()
  .strict();

export const sortSchema = z.enum(["newest", "popular"]).catch("newest");

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  pageSize: z.coerce.number().int().min(1).max(50).catch(12),
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.string().trim().max(60).optional().catch(undefined),
  tag: z.string().trim().max(60).optional().catch(undefined),
  sort: sortSchema,
});
export type ListQuery = z.infer<typeof listQuerySchema>;

/** Turns empty strings from forms into null. */
export function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = v === "" ? null : v;
  return out as T;
}
