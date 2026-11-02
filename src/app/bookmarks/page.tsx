import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Bookmark } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";
import { PostCard } from "@/components/posts/post-card";
import { PostGridSkeleton } from "@/components/posts/post-grid-skeleton";
import { getAuth, requireViewer } from "@/lib/auth";
import { listBookmarkedPosts } from "@/lib/data/posts";

export const metadata: Metadata = { title: "Bookmarks", robots: { index: false } };

export default function BookmarksPage({ searchParams }: PageProps<"/bookmarks">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-10">
        <h1 className="font-heading text-4xl font-semibold tracking-tight">Bookmarks</h1>
        <p className="mt-2 text-muted-foreground">Articles you saved to read later. Only you can see this list.</p>
      </header>
      <Suspense fallback={<PostGridSkeleton count={3} />}>
        <Bookmarks searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Bookmarks({ searchParams }: { searchParams: PageProps<"/bookmarks">["searchParams"] }) {
  const viewer = await requireViewer("/bookmarks");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase } = await getAuth();
  if (!supabase) return null;
  const result = await listBookmarkedPosts(supabase, viewer.id, page, 12);

  if (!result.items.length) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No bookmarks yet"
        description="Tap the bookmark icon on any article to save it here."
        action={
          <Link href="/blog" className={buttonVariants()}>
            Find something to read
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {result.items.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      <Pagination page={result.page} totalPages={result.totalPages} basePath="/bookmarks" />
    </>
  );
}
