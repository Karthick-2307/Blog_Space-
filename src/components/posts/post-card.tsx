import Image from "next/image";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { UserAvatar } from "@/components/common/user-avatar";
import { compactNumber, displayName, formatDate } from "@/lib/format";
import { isStorageImage } from "@/lib/image";
import { cn } from "@/lib/utils";
import type { PostSummary } from "@/types";

export function PostMeta({ post, className }: { post: PostSummary; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground", className)}>
      {post.author ? (
        <Link
          href={`/profile/${post.author.username}`}
          className="relative z-10 inline-flex items-center gap-2 font-medium text-foreground/90 hover:text-foreground"
        >
          <UserAvatar user={post.author} size="sm" />
          {displayName(post.author)}
        </Link>
      ) : null}
      <span aria-hidden>·</span>
      <time dateTime={post.published_at ?? post.created_at}>{formatDate(post.published_at ?? post.created_at)}</time>
      <span aria-hidden>·</span>
      <span>{post.reading_time} min read</span>
    </div>
  );
}

function Engagement({ post }: { post: PostSummary }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground tabular">
      <span className="inline-flex items-center gap-1" title={`${post.like_count} likes`}>
        <Heart className="size-3.5" aria-hidden />
        <span className="sr-only">Likes:</span> {compactNumber(post.like_count)}
      </span>
      <span className="inline-flex items-center gap-1" title={`${post.comment_count} comments`}>
        <MessageCircle className="size-3.5" aria-hidden />
        <span className="sr-only">Comments:</span> {compactNumber(post.comment_count)}
      </span>
    </div>
  );
}

function CategoryLink({ post }: { post: PostSummary }) {
  if (!post.category) return null;
  return (
    <Link
      href={`/category/${post.category.slug}`}
      className="relative z-10 text-xs font-medium tracking-wide text-primary uppercase hover:underline"
    >
      {post.category.name}
    </Link>
  );
}

/** Card with cover image. The whole card is clickable via a stretched link. */
export function PostCard({ post, priority = false }: { post: PostSummary; priority?: boolean }) {
  return (
    <article className="group relative flex flex-col">
      <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-sm bg-muted">
        {post.cover_image_url ? (
          <Image
            src={post.cover_image_url}
            unoptimized={!isStorageImage(post.cover_image_url)}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <CoverFallback title={post.title} />
        )}
      </div>
      <CategoryLink post={post} />
      <h3 className="mt-1.5 font-heading text-xl leading-snug font-semibold tracking-tight">
        <Link href={`/blog/${post.slug}`} className="decoration-1 underline-offset-4 after:absolute after:inset-0 group-hover:underline">
          {post.title}
        </Link>
      </h3>
      {post.excerpt ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        <PostMeta post={post} className="text-xs" />
      </div>
    </article>
  );
}

/** Horizontal row used for lists (popular, profile, related). */
export function PostRow({ post, rank }: { post: PostSummary; rank?: number }) {
  return (
    <article className="group relative flex gap-4 py-5">
      {rank !== undefined ? (
        <span className="w-8 shrink-0 font-heading text-3xl font-semibold text-primary tabular" aria-hidden>
          {rank}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <CategoryLink post={post} />
        <h3 className="mt-1 font-heading text-lg leading-snug font-semibold tracking-tight">
          <Link href={`/blog/${post.slug}`} className="decoration-1 underline-offset-4 after:absolute after:inset-0 group-hover:underline">
            {post.title}
          </Link>
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <PostMeta post={post} className="text-xs" />
          <Engagement post={post} />
        </div>
      </div>
      {post.cover_image_url && rank === undefined ? (
        <div className="relative hidden aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-sm bg-muted sm:block">
          <Image
            src={post.cover_image_url}
            unoptimized={!isStorageImage(post.cover_image_url)}
            alt=""
            fill
            sizes="128px"
            className="object-cover"
          />
        </div>
      ) : null}
    </article>
  );
}

/** Large featured layout for the homepage. */
export function FeaturedPost({ post }: { post: PostSummary }) {
  return (
    <article className="group relative grid gap-6 md:grid-cols-[1.25fr_1fr] md:items-center md:gap-10">
      <div className="relative aspect-[16/10] overflow-hidden rounded-sm bg-muted">
        {post.cover_image_url ? (
          <Image
            src={post.cover_image_url}
            unoptimized={!isStorageImage(post.cover_image_url)}
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 600px, 100vw"
            className="object-cover"
          />
        ) : (
          <CoverFallback title={post.title} large />
        )}
      </div>
      <div>
        <p className="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">Featured</p>
        <CategoryLink post={post} />
        <h2 className="mt-2 font-heading text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
          <Link href={`/blog/${post.slug}`} className="decoration-1 underline-offset-4 after:absolute after:inset-0 group-hover:underline">
            {post.title}
          </Link>
        </h2>
        {post.excerpt ? (
          <p className="mt-4 line-clamp-3 text-base leading-relaxed text-muted-foreground">{post.excerpt}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <PostMeta post={post} />
          <Engagement post={post} />
        </div>
      </div>
    </article>
  );
}

/** Typographic placeholder when a post has no cover image. */
function CoverFallback({ title, large = false }: { title: string; large?: boolean }) {
  return (
    <div className="absolute inset-0 flex items-end border border-border bg-muted p-5">
      <span
        aria-hidden
        className={cn(
          "line-clamp-3 font-heading font-semibold text-foreground/70",
          large ? "text-3xl" : "text-lg",
        )}
      >
        {title}
      </span>
    </div>
  );
}
