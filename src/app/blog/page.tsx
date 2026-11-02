import type { Metadata } from "next";
import { Suspense } from "react";
import { BlogFilters } from "@/components/posts/blog-filters";
import { PostGridSkeleton } from "@/components/posts/post-grid-skeleton";
import { PostListing } from "@/components/posts/post-listing";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuth } from "@/lib/auth";
import { listCategories } from "@/lib/data/taxonomy";

export const metadata: Metadata = {
  title: "Explore articles",
  description: "Search and browse every article published on BlogSpace.",
};

export default function BlogPage({ searchParams }: PageProps<"/blog">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-8">
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Explore</h1>
        <p className="mt-3 text-muted-foreground">Search every published article, or browse by topic.</p>
      </header>
      <div className="mb-10">
        <Suspense fallback={<Skeleton className="h-10 w-full" />}>
          <Filters />
        </Suspense>
      </div>
      <Suspense fallback={<PostGridSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Filters() {
  const { supabase } = await getAuth();
  const categories = supabase ? await listCategories(supabase) : [];
  return <BlogFilters categories={categories} />;
}

async function Results({ searchParams }: { searchParams: PageProps<"/blog">["searchParams"] }) {
  return <PostListing searchParams={await searchParams} basePath="/blog" />;
}
