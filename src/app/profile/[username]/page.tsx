import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarDays, Globe, PenSquare, Settings } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { UserAvatar } from "@/components/common/user-avatar";
import { PostRow } from "@/components/posts/post-card";
import { getAuth } from "@/lib/auth";
import { listAuthorPosts } from "@/lib/data/posts";
import { getProfileByUsername } from "@/lib/data/profiles";
import { displayName, formatDate } from "@/lib/format";
import { createPublicClient } from "@/lib/supabase/public";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/profile/[username]">): Promise<Metadata> {
  const { username } = await params;
  const supabase = createPublicClient();
  if (!supabase || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) return { title: "Profile" };
  const { data } = await supabase.from("profiles").select("username, display_name, bio").eq("username", username).maybeSingle();
  if (!data) return { title: "Profile not found" };
  return { title: `${displayName(data)} (@${data.username})`, description: data.bio ?? undefined };
}

export default function ProfilePage({ params }: PageProps<"/profile/[username]">) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: { params: PageProps<"/profile/[username]">["params"] }) {
  const { username } = await params;
  const { supabase, userId } = await getAuth();
  if (!supabase) notFound();
  const profile = await getProfileByUsername(supabase, decodeURIComponent(username));
  if (!profile) notFound();

  const posts = await listAuthorPosts(supabase, profile.id, { status: "published" });
  const isOwner = userId === profile.id;
  let website: URL | null = null;
  try {
    website = profile.website_url ? new URL(profile.website_url) : null;
  } catch {
    website = null;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <UserAvatar user={profile} size="lg" className="size-20 text-2xl data-[size=lg]:size-20" />
        <div className="flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-heading text-3xl font-semibold tracking-tight">{displayName(profile)}</h1>
              <p className="text-muted-foreground">@{profile.username}</p>
            </div>
            {isOwner ? (
              <Link href="/settings" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
                <Settings /> Edit profile
              </Link>
            ) : null}
          </div>
          {profile.bio ? <p className="mt-4 max-w-prose leading-relaxed">{profile.bio}</p> : null}
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <li className="tabular">
              <strong className="font-semibold text-foreground">{posts.length}</strong>{" "}
              {posts.length === 1 ? "article" : "articles"}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden /> Joined {formatDate(profile.created_at)}
            </li>
            {website ? (
              <li>
                <a
                  href={website.toString()}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  <Globe className="size-4" aria-hidden /> {website.hostname}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </header>

      <section aria-labelledby="articles-heading" className="mt-12">
        <h2 id="articles-heading" className="border-b border-border/60 pb-3 font-heading text-2xl font-semibold">
          Articles
        </h2>
        {posts.length ? (
          <div className="divide-y divide-border/60">
            {posts.map((p) => (
              <PostRow key={p.id} post={p} />
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-6"
            icon={PenSquare}
            title={isOwner ? "You haven't published anything yet" : "No articles yet"}
            description={isOwner ? "Your published articles will appear on your profile." : `${displayName(profile)} hasn't published anything yet.`}
            action={
              isOwner ? (
                <Link href="/write" className={buttonVariants()}>
                  Write your first article
                </Link>
              ) : undefined
            }
          />
        )}
      </section>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-14 sm:px-6" aria-busy="true" aria-label="Loading profile">
      <div className="flex gap-6">
        <Skeleton className="size-20 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}
