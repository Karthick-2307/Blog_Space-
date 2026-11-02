"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { ExternalLink, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { countWords, readingTime, slugify } from "@/lib/format";
import { api, ApiRequestError, uploadImage } from "@/lib/http";
import { cn } from "@/lib/utils";
import type { Category, PostDetail } from "@/types";
import { RichTextEditor, type EditorValue } from "./rich-text-editor";

type Errors = Partial<Record<"title" | "slug" | "excerpt" | "contentHtml" | "tags" | "coverImageUrl" | "categoryId" | "_", string>>;

export function PostEditor({ post, categories }: { post: PostDetail | null; categories: Category[] }) {
  const router = useRouter();
  const [postId, setPostId] = useState(post?.id ?? null);
  const [status, setStatus] = useState(post?.status ?? "draft");
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [coverUrl, setCoverUrl] = useState<string | null>(post?.cover_image_url ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(post?.category_id ?? null);
  const [tags, setTags] = useState<string[]>(post?.tags.map((t) => t.name) ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const initialContent = useMemo<JSONContent | string>(() => {
    const json = post?.content_json as JSONContent | undefined;
    return json && json.type === "doc" ? json : (post?.content_html ?? "");
  }, [post]);
  const [content, setContent] = useState<EditorValue>({
    json: typeof initialContent === "string" ? { type: "doc", content: [] } : initialContent,
    html: post?.content_html ?? "",
    text: "",
  });
  const [saving, setSaving] = useState<"draft" | "published" | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const coverInput = useRef<HTMLInputElement>(null);

  const snapshot = JSON.stringify({ title, slug, excerpt, coverUrl, categoryId, tags, html: content.html });
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const words = content.text ? countWords(content.text) : 0;

  function addTag(raw: string) {
    const name = raw.trim().replace(/^#/, "").slice(0, 30);
    if (!name) return;
    if (tags.length >= 5) return setErrors((e) => ({ ...e, tags: "Use at most 5 tags." }));
    if (tags.some((t) => slugify(t) === slugify(name))) return;
    setTags([...tags, name]);
    setTagDraft("");
    setErrors((e) => ({ ...e, tags: undefined }));
  }

  async function onCoverSelected(file: File | undefined) {
    if (!file) return;
    setUploadingCover(true);
    try {
      setCoverUrl(await uploadImage(file, "cover"));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingCover(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  }

  function validate(target: "draft" | "published"): Errors {
    const e: Errors = {};
    if (!title.trim()) e.title = "Give your article a title.";
    else if (title.length > 200) e.title = "Title is too long.";
    if (slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) e.slug = "Use lowercase letters, numbers and dashes.";
    if (excerpt.length > 300) e.excerpt = "Excerpt must be at most 300 characters.";
    if (target === "published" && words < 5) e.contentHtml = "Write at least a few sentences before publishing.";
    return e;
  }

  async function save(target: "draft" | "published") {
    const v = validate(target);
    setErrors(v);
    if (Object.keys(v).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSaving(target);
    const body = {
      title: title.trim(),
      ...(slug ? { slug } : {}),
      excerpt: excerpt.trim() || null,
      contentJson: content.json as Record<string, unknown>,
      contentHtml: content.html,
      coverImageUrl: coverUrl,
      categoryId,
      tags,
      status: target,
    };
    try {
      const { data } = postId
        ? await api<PostDetail>(`/api/v1/posts/${postId}`, { method: "PATCH", body })
        : await api<PostDetail>("/api/v1/posts", { method: "POST", body });

      setStatus(data.status);
      setSlug(data.slug);
      if (data.excerpt && !excerpt) setExcerpt(data.excerpt);
      setSavedSnapshot(
        JSON.stringify({
          title: body.title,
          slug: data.slug,
          excerpt: data.excerpt && !excerpt ? data.excerpt : excerpt,
          coverUrl,
          categoryId,
          tags,
          html: content.html,
        }),
      );

      if (target === "published") {
        toast.success(post?.status === "published" ? "Article updated." : "Article published!");
        router.push(`/blog/${data.slug}`);
        router.refresh();
        return;
      }
      toast.success("Draft saved.");
      if (!postId) {
        setPostId(data.id);
        router.replace(`/write/${data.id}`, { scroll: false });
      } else {
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.details) {
          const mapped: Errors = {};
          for (const [k, msgs] of Object.entries(err.details)) mapped[k as keyof Errors] = msgs[0];
          setErrors(mapped);
        }
        if (err.code === "CONFLICT") setErrors((e) => ({ ...e, slug: "That URL slug is already used. Try another." }));
        if (err.status === 401) {
          toast.error("Your session expired. Sign in again — your changes are still on this page.");
          return;
        }
      }
      toast.error((err as Error).message);
    } finally {
      setSaving(null);
    }
  }

  const busy = saving !== null || uploadingCover;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Badge variant={status === "published" ? "default" : "secondary"} className="capitalize">
            {status}
          </Badge>
          <span className="tabular">
            {words} words · {readingTime(content.text || " ")} min read
          </span>
          {dirty ? <span className="text-amber-500">Unsaved changes</span> : null}
        </div>
        <div className="flex items-center gap-2">
          {status === "published" && slug ? (
            <a href={`/blog/${slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              View <ExternalLink className="size-3.5" />
            </a>
          ) : null}
          <Button variant="outline" onClick={() => save("draft")} disabled={busy}>
            {saving === "draft" ? <Loader2 className="animate-spin" /> : null}
            {status === "published" ? "Unpublish to draft" : "Save draft"}
          </Button>
          <Button onClick={() => save("published")} disabled={busy}>
            {saving === "published" ? <Loader2 className="animate-spin" /> : null}
            {status === "published" ? "Update" : "Publish"}
          </Button>
        </div>
      </div>

      {errors._ ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {errors._}
        </p>
      ) : null}

      {/* Cover image */}
      <div className="mb-8">
        {coverUrl ? (
          <div className="group relative aspect-[2/1] overflow-hidden rounded-md bg-muted">
            <Image src={coverUrl} alt="Cover image preview" fill unoptimized className="object-cover" sizes="900px" />
            <div className="absolute top-3 right-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => coverInput.current?.click()} disabled={busy}>
                Change
              </Button>
              <Button size="icon-sm" variant="secondary" onClick={() => setCoverUrl(null)} aria-label="Remove cover image" disabled={busy}>
                <X />
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            disabled={busy}
            className="flex h-28 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            {uploadingCover ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {uploadingCover ? "Uploading cover…" : "Add a cover image"}
          </button>
        )}
        <input
          ref={coverInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          tabIndex={-1}
          aria-label="Upload cover image"
          onChange={(e) => onCoverSelected(e.target.files?.[0])}
        />
      </div>

      {/* Title */}
      <label htmlFor="post-title" className="sr-only">
        Title
      </label>
      <Textarea
        id="post-title"
        value={title}
        onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
        placeholder="Title"
        rows={1}
        maxLength={200}
        aria-invalid={Boolean(errors.title)}
        aria-describedby={errors.title ? "title-error" : undefined}
        className="min-h-0 resize-none border-0 bg-transparent px-0 font-heading text-4xl leading-tight font-semibold tracking-tight shadow-none focus-visible:ring-0 sm:text-5xl dark:bg-transparent"
      />
      {errors.title ? (
        <p id="title-error" role="alert" className="mt-1 text-sm text-destructive">
          {errors.title}
        </p>
      ) : null}

      <label htmlFor="post-excerpt" className="sr-only">
        Excerpt
      </label>
      <Textarea
        id="post-excerpt"
        value={excerpt}
        onChange={(e) => setExcerpt(e.target.value)}
        placeholder="Add a short subtitle or excerpt (optional)"
        rows={2}
        maxLength={300}
        aria-invalid={Boolean(errors.excerpt)}
        className="mt-2 resize-none border-0 bg-transparent px-0 font-serif text-xl text-muted-foreground shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      {errors.excerpt ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.excerpt}
        </p>
      ) : null}

      {/* Content */}
      <div className="mt-6">
        <span id="content-label" className="sr-only">
          Article content
        </span>
        <RichTextEditor
          initialContent={initialContent}
          ariaLabelledBy="content-label"
          onChange={(v) => {
            setContent(v);
            if (errors.contentHtml) setErrors((e) => ({ ...e, contentHtml: undefined }));
          }}
        />
        {errors.contentHtml ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {errors.contentHtml}
          </p>
        ) : null}
      </div>

      {/* Details */}
      <section aria-labelledby="details-heading" className="mt-10 grid gap-6 rounded-md border border-border bg-card/40 p-6 sm:grid-cols-2">
        <h2 id="details-heading" className="font-heading text-xl font-semibold sm:col-span-2">
          Details
        </h2>

        <div className="space-y-2">
          <Label htmlFor="post-category">Category</Label>
          <Select
            value={categoryId ?? "none"}
            onValueChange={(v) => setCategoryId(!v || v === "none" ? null : String(v))}
            items={[{ value: "none", label: "No category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          >
            <SelectTrigger id="post-category" className="w-full data-[size=default]:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="post-slug">URL slug</Label>
          <Input
            id="post-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-"))}
            placeholder={title ? `${slugify(title) || "post"}-…` : "Generated from the title"}
            maxLength={120}
            className="h-10 font-mono text-sm"
            aria-invalid={Boolean(errors.slug)}
            aria-describedby="slug-hint"
          />
          <p id="slug-hint" className={cn("text-xs", errors.slug ? "text-destructive" : "text-muted-foreground")}>
            {errors.slug ?? "Leave empty to generate one from the title."}
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="post-tags">Tags</Label>
          <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border border-input px-2 py-1.5 dark:bg-input/30">
            {tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1">
                #{t}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  aria-label={`Remove tag ${t}`}
                  className="rounded-full hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            <input
              id="post-tags"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag(tagDraft);
                } else if (e.key === "Backspace" && !tagDraft && tags.length) {
                  setTags(tags.slice(0, -1));
                }
              }}
              onBlur={() => tagDraft && addTag(tagDraft)}
              placeholder={tags.length >= 5 ? "" : "Add a tag and press Enter"}
              disabled={tags.length >= 5}
              maxLength={30}
              className="min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-describedby="tags-hint"
            />
          </div>
          <p id="tags-hint" className={cn("text-xs", errors.tags ? "text-destructive" : "text-muted-foreground")}>
            {errors.tags ?? `Up to 5 tags. ${tags.length}/5 used.`}
          </p>
        </div>
      </section>
    </div>
  );
}
