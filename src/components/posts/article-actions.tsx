"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bookmark, Heart, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/http";
import { compactNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  postId: string;
  title: string;
  initialLiked: boolean;
  initialBookmarked: boolean;
  initialLikeCount: number;
  signedIn: boolean;
  loginHref: string;
};

/** Like, bookmark and share. Optimistic, with rollback when the server says no. */
export function ArticleActions(props: Props) {
  const router = useRouter();
  const [liked, setLiked] = useState(props.initialLiked);
  const [likeCount, setLikeCount] = useState(props.initialLikeCount);
  const [bookmarked, setBookmarked] = useState(props.initialBookmarked);
  const [busy, setBusy] = useState<"like" | "bookmark" | null>(null);

  function requireLogin(action: string) {
    toast.info(`Sign in to ${action}.`, {
      action: { label: "Sign in", onClick: () => router.push(props.loginHref) },
    });
  }

  async function toggleLike() {
    if (!props.signedIn) return requireLogin("like articles");
    if (busy) return;
    const next = !liked;
    setBusy("like");
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const { data } = await api<{ likeCount: number }>(`/api/v1/posts/${props.postId}/like`, {
        method: next ? "POST" : "DELETE",
      });
      setLikeCount(data.likeCount);
    } catch (err) {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function toggleBookmark() {
    if (!props.signedIn) return requireLogin("save articles");
    if (busy) return;
    const next = !bookmarked;
    setBusy("bookmark");
    setBookmarked(next);
    try {
      await api(`/api/v1/posts/${props.postId}/bookmark`, { method: next ? "POST" : "DELETE" });
      toast.success(next ? "Saved to your bookmarks." : "Removed from bookmarks.");
    } catch (err) {
      setBookmarked(!next);
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: props.title, url });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.error("Could not copy the link.");
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        onClick={toggleLike}
        aria-pressed={liked}
        aria-label={liked ? "Unlike this article" : "Like this article"}
        className={cn("h-9 gap-1.5 px-3 tabular", liked && "text-rose-500 hover:text-rose-500")}
      >
        <Heart className={cn("transition-transform active:scale-125", liked && "fill-current")} />
        {compactNumber(likeCount)}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleBookmark}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? "Remove bookmark" : "Bookmark this article"}
        className={cn("size-9", bookmarked && "text-primary hover:text-primary")}
      >
        <Bookmark className={cn(bookmarked && "fill-current")} />
      </Button>
      <Button variant="ghost" size="icon" onClick={share} aria-label="Share this article" className="size-9">
        <Share2 />
      </Button>
    </div>
  );
}
