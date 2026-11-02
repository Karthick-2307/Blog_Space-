import type { Metadata } from "next";
import { Suspense } from "react";
import { PostGridSkeleton } from "@/components/posts/post-grid-skeleton";
import { PostListing } from "@/components/posts/post-listing";

export async function generateMetadata({ params }: PageProps<"/tag/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: `#${slug}`, description: `Articles tagged #${slug} on BlogSpace.` };
}

export default function TagPage({ params, searchParams }: PageProps<"/tag/[slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <Suspense fallback={<PostGridSkeleton />}>
        <Results params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({
  params,
  searchParams,
}: {
  params: PageProps<"/tag/[slug]">["params"];
  searchParams: PageProps<"/tag/[slug]">["searchParams"];
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  return (
    <>
      <header className="mb-10">
        <p className="text-xs font-medium tracking-widest text-primary uppercase">Tag</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">#{slug}</h1>
      </header>
      <PostListing searchParams={sp} basePath={`/tag/${slug}`} fixed={{ tag: slug }} />
    </>
  );
}
