import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PostGridSkeleton } from "@/components/posts/post-grid-skeleton";
import { PostListing } from "@/components/posts/post-listing";
import { Skeleton } from "@/components/ui/skeleton";
import { createPublicClient } from "@/lib/supabase/public";

async function getCategory(slug: string) {
  const supabase = createPublicClient();
  if (!supabase) return null;
  const { data } = await supabase.from("categories").select("name, slug, description").eq("slug", slug).maybeSingle();
  return data as { name: string; slug: string; description: string | null } | null;
}

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const category = await getCategory((await params).slug);
  return category
    ? { title: category.name, description: category.description ?? `Articles about ${category.name}.` }
    : { title: "Category not found" };
}

export default function CategoryPage({ params, searchParams }: PageProps<"/category/[slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <Suspense fallback={<Skeleton className="mb-10 h-20 w-72" />}>
        <Heading params={params} />
      </Suspense>
      <Suspense fallback={<PostGridSkeleton />}>
        <Results params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Heading({ params }: { params: PageProps<"/category/[slug]">["params"] }) {
  const category = await getCategory((await params).slug);
  if (!category) notFound();
  return (
    <header className="mb-10">
      <p className="text-xs font-medium tracking-widest text-primary uppercase">Category</p>
      <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">{category.name}</h1>
      {category.description ? <p className="mt-3 max-w-xl text-muted-foreground">{category.description}</p> : null}
    </header>
  );
}

async function Results({
  params,
  searchParams,
}: {
  params: PageProps<"/category/[slug]">["params"];
  searchParams: PageProps<"/category/[slug]">["searchParams"];
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  return <PostListing searchParams={sp} basePath={`/category/${slug}`} fixed={{ category: slug }} />;
}
