import Link from "next/link";
import { notFound } from "next/navigation";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";
import { PostCard } from "@/components/posts/post-card";
import { getAuth } from "@/lib/auth";
import { listPublishedPosts } from "@/lib/data/posts";
import { listQuerySchema } from "@/lib/validation";

type Search = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/** Server-rendered, paginated list of published posts driven by URL params. */
export async function PostListing({
  searchParams,
  basePath,
  fixed = {},
}: {
  searchParams: Search;
  basePath: string;
  fixed?: { category?: string; tag?: string };
}) {
  const query = listQuerySchema.parse({
    page: first(searchParams.page),
    pageSize: 12,
    q: first(searchParams.q) || undefined,
    category: fixed.category ?? (first(searchParams.category) || undefined),
    tag: fixed.tag ?? (first(searchParams.tag) || undefined),
    sort: first(searchParams.sort),
  });

  const { supabase } = await getAuth();
  if (!supabase) {
    return (
      <EmptyState
        icon={SearchX}
        title="No database connected"
        description="Articles appear here once Supabase is configured."
      />
    );
  }

  const result = await listPublishedPosts(supabase, query);
  if (result.unknownFilter && (fixed.category || fixed.tag)) notFound();

  if (!result.items.length) {
    const filtered = Boolean(query.q || query.category || query.tag);
    return (
      <EmptyState
        icon={SearchX}
        title={filtered ? "No matching articles" : "Nothing published yet"}
        description={
          filtered
            ? "Try a different search term or remove a filter."
            : "Be the first to publish something here."
        }
        action={
          filtered ? (
            <Link href={basePath} className={buttonVariants({ variant: "outline" })}>
              Clear filters
            </Link>
          ) : (
            <Link href="/write" className={buttonVariants()}>
              Write an article
            </Link>
          )
        }
      />
    );
  }

  return (
    <>
      <p className="mb-6 text-sm text-muted-foreground tabular" aria-live="polite">
        {result.total} {result.total === 1 ? "article" : "articles"}
        {query.q ? (
          <>
            {" "}
            for “<span className="text-foreground">{query.q}</span>”
          </>
        ) : null}
      </p>
      <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {result.items.map((post, i) => (
          <PostCard key={post.id} post={post} priority={i < 3} />
        ))}
      </div>
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        basePath={basePath}
        params={{
          q: query.q,
          sort: query.sort === "popular" ? "popular" : undefined,
          category: fixed.category ? undefined : query.category,
          tag: fixed.tag ? undefined : query.tag,
        }}
      />
    </>
  );
}
