import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink, FileText, Heart, MessageCircle, Pencil, PenSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { DeletePostButton } from "@/components/dashboard/delete-post-button";
import { getAuth, requireViewer } from "@/lib/auth";
import { listAuthorPosts } from "@/lib/data/posts";
import { compactNumber, displayName, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
] as const;

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const viewer = await requireViewer("/dashboard");
  const sp = await searchParams;
  const filter = sp.status === "draft" || sp.status === "published" ? sp.status : "all";

  const { supabase } = await getAuth();
  const posts = supabase ? await listAuthorPosts(supabase, viewer.id) : [];
  const published = posts.filter((p) => p.status === "published");
  const drafts = posts.filter((p) => p.status === "draft");
  const shown = filter === "all" ? posts : filter === "draft" ? drafts : published;
  const likes = published.reduce((n, p) => n + p.like_count, 0);
  const comments = published.reduce((n, p) => n + p.comment_count, 0);

  const stats = [
    { label: "Published", value: published.length, icon: FileText },
    { label: "Drafts", value: drafts.length, icon: Pencil },
    { label: "Likes received", value: likes, icon: Heart },
    { label: "Comments received", value: comments, icon: MessageCircle },
  ];

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back, {displayName(viewer)}</p>
          <h1 className="mt-1 font-heading text-4xl font-semibold tracking-tight">Your dashboard</h1>
        </div>
        <Link href="/write" className={cn(buttonVariants(), "gap-2")}>
          <PenSquare /> New article
        </Link>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-md border border-border bg-card/50 p-4">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="size-3.5" aria-hidden /> {label}
            </dt>
            <dd className="mt-2 font-heading text-3xl font-semibold tabular">{compactNumber(value)}</dd>
          </div>
        ))}
      </dl>

      <nav aria-label="Filter articles" className="mt-10 flex gap-1 border-b border-border">
        {FILTERS.map((f) => {
          const count = f.key === "all" ? posts.length : f.key === "draft" ? drafts.length : published.length;
          const active = filter === f.key;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? "/dashboard" : `/dashboard?status=${f.key}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label} <span className="text-muted-foreground tabular">{count}</span>
            </Link>
          );
        })}
      </nav>

      {shown.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={PenSquare}
          title={filter === "draft" ? "No drafts" : filter === "published" ? "Nothing published yet" : "You haven't written anything yet"}
          description="Your articles will show up here. Drafts stay private until you publish them."
          action={
            <Link href="/write" className={buttonVariants()}>
              Write an article
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-border/60">
          {shown.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant={p.status === "published" ? "default" : "secondary"} className="capitalize">
                    {p.status}
                  </Badge>
                  {p.category ? <span className="text-xs text-muted-foreground">{p.category.name}</span> : null}
                </div>
                <Link href={`/write/${p.id}`} className="mt-2 block truncate font-heading text-lg font-semibold hover:text-primary">
                  {p.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground tabular">
                  {p.status === "published" ? `Published ${formatDate(p.published_at)}` : `Last edited ${formatDate(p.updated_at)}`}
                  {p.status === "published" ? (
                    <>
                      {" · "}
                      {p.like_count} likes · {p.comment_count} comments
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {p.status === "published" ? (
                  <Link
                    href={`/blog/${p.slug}`}
                    className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                    aria-label={`View "${p.title}"`}
                    title="View"
                  >
                    <ExternalLink />
                  </Link>
                ) : null}
                <Link
                  href={`/write/${p.id}`}
                  className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                  aria-label={`Edit "${p.title}"`}
                  title="Edit"
                >
                  <Pencil />
                </Link>
                <DeletePostButton postId={p.id} title={p.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-12 w-72" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-md" />
        ))}
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
