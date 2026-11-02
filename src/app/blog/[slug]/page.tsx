import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/common/user-avatar";
import { CommentsSection } from "@/components/comments/comments-section";
import { ArticleActions } from "@/components/posts/article-actions";
import { PostRow } from "@/components/posts/post-card";
import { getAuth, getViewer } from "@/lib/auth";
import { listComments } from "@/lib/data/comments";
import { getPublishedPostBySlug, getRelatedPosts, getViewerReactions } from "@/lib/data/posts";
import { getProfileById } from "@/lib/data/profiles";
import { displayName, formatDate } from "@/lib/format";
import { isStorageImage } from "@/lib/image";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { createPublicClient } from "@/lib/supabase/public";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createPublicClient();
  if (!supabase) return { title: "Article" };
  const { data } = await supabase
    .from("posts")
    .select("title, excerpt, cover_image_url, published_at, updated_at, author:profiles!posts_author_id_fkey(username, display_name)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return { title: "Article not found" };
  const author = data.author as unknown as { username: string; display_name: string | null } | null;
  return {
    title: data.title,
    description: data.excerpt ?? undefined,
    alternates: { canonical: `/blog/${slug}` },
    authors: author ? [{ name: displayName(author), url: `/profile/${author.username}` }] : undefined,
    openGraph: {
      type: "article",
      title: data.title,
      description: data.excerpt ?? undefined,
      publishedTime: data.published_at ?? undefined,
      modifiedTime: data.updated_at ?? undefined,
      images: data.cover_image_url ? [{ url: data.cover_image_url }] : undefined,
    },
  };
}

export default function ArticlePage({ params }: PageProps<"/blog/[slug]">) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <Article params={params} />
    </Suspense>
  );
}

async function Article({ params }: { params: PageProps<"/blog/[slug]">["params"] }) {
  const { slug } = await params;
  const { supabase, userId } = await getAuth();
  if (!supabase) notFound();

  const post = await getPublishedPostBySlug(supabase, slug);
  if (!post) notFound();

  const [reactions, viewer, comments, related, authorProfile] = await Promise.all([
    userId ? getViewerReactions(supabase, userId, post.id) : Promise.resolve({ liked: false, bookmarked: false }),
    getViewer(),
    listComments(supabase, post.id, 1, 20),
    getRelatedPosts(supabase, post),
    getProfileById(supabase, post.author_id),
  ]);

  const loginHref = `/login?next=${encodeURIComponent(`/blog/${post.slug}`)}`;
  const isAuthor = userId === post.author_id;
  const wasUpdated =
    post.published_at && new Date(post.updated_at).getTime() - new Date(post.published_at).getTime() > 60 * 60 * 1000;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt ?? undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    image: post.cover_image_url ?? undefined,
    author: post.author ? { "@type": "Person", name: displayName(post.author) } : undefined,
  };

  return (
    <article className="pb-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <header className="mx-auto max-w-3xl px-4 pt-12 sm:px-6 sm:pt-16">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {post.category ? (
            <Link
              href={`/category/${post.category.slug}`}
              className="font-medium tracking-wide text-primary uppercase hover:underline"
            >
              {post.category.name}
            </Link>
          ) : null}
          {isAuthor ? (
            <Link
              href={`/write/${post.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-auto gap-1.5")}
            >
              <Pencil /> Edit article
            </Link>
          ) : null}
        </div>
        <h1 className="mt-4 font-heading text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
          {post.title}
        </h1>
        {post.excerpt ? (
          <p className="mt-5 font-serif text-xl leading-relaxed text-muted-foreground">{post.excerpt}</p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-y border-border/60 py-4">
          <div className="flex items-center gap-3">
            {post.author ? (
              <Link href={`/profile/${post.author.username}`}>
                <UserAvatar user={post.author} size="lg" />
              </Link>
            ) : null}
            <div className="text-sm">
              {post.author ? (
                <Link href={`/profile/${post.author.username}`} className="font-medium hover:underline">
                  {displayName(post.author)}
                </Link>
              ) : null}
              <p className="text-muted-foreground">
                <time dateTime={post.published_at ?? undefined}>{formatDate(post.published_at)}</time>
                {" · "}
                {post.reading_time} min read
                {wasUpdated ? (
                  <>
                    {" · "}Updated <time dateTime={post.updated_at}>{formatDate(post.updated_at)}</time>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <ArticleActions
            postId={post.id}
            title={post.title}
            initialLiked={reactions.liked}
            initialBookmarked={reactions.bookmarked}
            initialLikeCount={post.like_count}
            signedIn={Boolean(userId)}
            loginHref={loginHref}
          />
        </div>
      </header>

      {post.cover_image_url ? (
        <figure className="mx-auto mt-10 max-w-5xl px-4 sm:px-6">
          <div className="relative aspect-[2/1] overflow-hidden rounded-md bg-muted">
            <Image
              src={post.cover_image_url}
              unoptimized={!isStorageImage(post.cover_image_url)}
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 1024px, 100vw"
              className="object-cover"
            />
          </div>
        </figure>
      ) : null}

      <div className="mx-auto mt-12 max-w-3xl px-4 sm:px-6">
        <div
          className="prose-article mx-auto"
          // Sanitized on save AND here, because rows could be written directly through the Data API.
          dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(post.content_html) }}
        />

        {post.tags.length ? (
          <ul className="mt-12 flex flex-wrap gap-x-4 gap-y-1" aria-label="Tags">
            {post.tags.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tag/${t.slug}`}
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  #{t.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {authorProfile ? (
          <aside className="mt-12 flex gap-4 border-y border-border py-6" aria-label="About the author">
            <UserAvatar user={authorProfile} size="lg" />
            <div>
              <p className="text-xs tracking-widest text-muted-foreground uppercase">Written by</p>
              <Link href={`/profile/${authorProfile.username}`} className="font-heading text-xl font-semibold hover:underline">
                {displayName(authorProfile)}
              </Link>
              {authorProfile.bio ? (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{authorProfile.bio}</p>
              ) : null}
            </div>
          </aside>
        ) : null}

        <CommentsSection
          postId={post.id}
          initial={comments.items}
          total={comments.total}
          pageSize={comments.pageSize}
          viewer={viewer ? { id: viewer.id, username: viewer.username, display_name: viewer.display_name, avatar_url: viewer.avatar_url } : null}
          loginHref={loginHref}
        />

        {related.length ? (
          <section aria-labelledby="related-heading" className="mt-16 border-t border-border/60 pt-10">
            <h2 id="related-heading" className="font-heading text-2xl font-semibold">
              Keep reading
            </h2>
            <div className="divide-y divide-border/60">
              {related.map((p) => (
                <PostRow key={p.id} post={p} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
}

function ArticleSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pt-16 sm:px-6" aria-busy="true" aria-label="Loading article">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-6 w-full" />
      <div className="flex items-center gap-3 py-4">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="aspect-[2/1] w-full rounded-md" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}
