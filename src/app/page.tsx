import Link from "next/link";
import { Suspense } from "react";
import { FileText, PenSquare } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { FeaturedPost, PostCard, PostRow } from "@/components/posts/post-card";
import { PostGridSkeleton } from "@/components/posts/post-grid-skeleton";
import { getAuth } from "@/lib/auth";
import { getHomeFeed } from "@/lib/data/posts";
import { listCategories } from "@/lib/data/taxonomy";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Suspense fallback={<HomeSkeleton />}>
        <HomeFeed />
      </Suspense>
    </>
  );
}

function Hero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h1 className="max-w-2xl font-heading text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
            Read what people are writing, and write something yourself.
          </h1>
          <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
            BlogSpace is a simple place to publish articles and talk about them in the comments. Anyone can sign
            up and start writing.
          </p>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/write" className={cn(buttonVariants(), "h-10 px-4")}>
            Write a post
          </Link>
          <Link href="/blog" className="text-sm font-medium underline-offset-4 hover:underline">
            Browse articles
          </Link>
        </div>
      </div>
    </section>
  );
}

async function HomeFeed() {
  const { supabase } = await getAuth();
  if (!supabase) {
    return (
      <Section>
        <EmptyState
          icon={FileText}
          title="No articles to show yet"
          description="Articles appear here once the database is connected. See SUPABASE_SETUP.md."
        />
      </Section>
    );
  }

  const [{ latest, popular }, categories] = await Promise.all([getHomeFeed(supabase), listCategories(supabase)]);
  const featured = popular[0] ?? latest[0];
  const rest = latest.filter((p) => p.id !== featured?.id).slice(0, 6);

  return (
    <>
      {categories.length ? (
        <nav aria-label="Categories" className="border-b border-border">
          <ul className="mx-auto flex max-w-6xl gap-x-6 overflow-x-auto px-4 py-3 sm:px-6 [scrollbar-width:none]">
            {categories.map((c) => (
              <li key={c.id} className="shrink-0">
                <Link
                  href={`/category/${c.slug}`}
                  className="text-xs font-medium tracking-wider whitespace-nowrap text-muted-foreground uppercase transition-colors hover:text-foreground"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {!featured ? (
        <Section>
          <EmptyState
            icon={PenSquare}
            title="No articles yet"
            description="Nobody has published anything yet. Be the first."
            action={
              <Link href="/write" className={buttonVariants()}>
                Write the first article
              </Link>
            }
          />
        </Section>
      ) : (
        <>
          <Section>
            <FeaturedPost post={featured} />
          </Section>

          <Section className="grid gap-14 lg:grid-cols-[1fr_320px]">
            <div>
              <SectionHeading title="Latest" href="/blog" />
              {rest.length ? (
                <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2">
                  {rest.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">More articles will show up here as people publish.</p>
              )}
            </div>
            <aside aria-labelledby="popular-heading">
              <SectionHeading id="popular-heading" title="Popular" href="/blog?sort=popular" />
              {popular.length ? (
                <ol className="divide-y divide-border/60">
                  {popular.map((post, i) => (
                    <li key={post.id}>
                      <PostRow post={post} rank={i + 1} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Articles show up here once readers start liking them.
                </p>
              )}
            </aside>
          </Section>
        </>
      )}
    </>
  );
}

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("mx-auto max-w-6xl px-4 pt-14 sm:px-6", className)}>{children}</section>;
}

function SectionHeading({ title, href, id }: { title: string; href: string; id?: string }) {
  return (
    <div className="mb-6 flex items-baseline justify-between border-b-2 border-foreground pb-2">
      <h2 id={id} className="text-xs font-semibold tracking-[0.18em] uppercase">
        {title}
      </h2>
      <Link href={href} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        See all
      </Link>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-14 px-4 pt-14 sm:px-6">
      <div className="grid gap-8 md:grid-cols-[1.25fr_1fr] md:items-center">
        <Skeleton className="aspect-[16/10] w-full rounded-sm" />
        <div className="space-y-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
      <PostGridSkeleton count={3} />
    </div>
  );
}
