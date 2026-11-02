"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, MessageCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/common/user-avatar";
import { displayName, timeAgo } from "@/lib/format";
import { api } from "@/lib/http";
import type { Comment } from "@/types";

const MAX = 2000;

type Props = {
  postId: string;
  initial: Comment[];
  total: number;
  pageSize: number;
  viewer: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
  loginHref: string;
};

export function CommentsSection({ postId, initial, total: initialTotal, pageSize, viewer, loginHref }: Props) {
  const [comments, setComments] = useState(initial);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadMore() {
    setLoadingMore(true);
    setLoadError(null);
    try {
      const next = page + 1;
      const { data, meta } = await api<Comment[]>(
        `/api/v1/posts/${postId}/comments?page=${next}&pageSize=${pageSize}`,
      );
      setComments((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...data.filter((c) => !seen.has(c.id))];
      });
      setTotal(Number(meta?.total ?? total));
      setPage(next);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section aria-labelledby="comments-heading" className="mt-16 border-t border-border/60 pt-10">
      <h2 id="comments-heading" className="flex items-center gap-2 font-heading text-2xl font-semibold">
        Comments <span className="text-base font-normal text-muted-foreground tabular">({total})</span>
      </h2>

      <div className="mt-6">
        {viewer ? (
          <CommentForm
            postId={postId}
            viewer={viewer}
            onCreated={(c) => {
              setComments((prev) => [c, ...prev]);
              setTotal((t) => t + 1);
            }}
          />
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-md border border-border bg-card/50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Sign in to join the conversation.</p>
            <Link href={loginHref} className={buttonVariants({ size: "sm" })}>
              Sign in to comment
            </Link>
          </div>
        )}
      </div>

      {comments.length === 0 ? (
        <div className="mt-10 flex flex-col items-center py-8 text-center text-muted-foreground">
          <MessageCircle className="mb-3 size-6" aria-hidden />
          <p className="text-sm">No comments yet. Start the discussion.</p>
        </div>
      ) : (
        <ol className="mt-8 divide-y divide-border/60">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              canManage={viewer?.id === c.author_id}
              onUpdated={(u) => setComments((prev) => prev.map((x) => (x.id === u.id ? u : x)))}
              onDeleted={(id) => {
                setComments((prev) => prev.filter((x) => x.id !== id));
                setTotal((t) => Math.max(0, t - 1));
              }}
            />
          ))}
        </ol>
      )}

      {comments.length < total ? (
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="animate-spin" /> : null}
            Load more comments
          </Button>
          {loadError ? (
            <p role="alert" className="text-sm text-destructive">
              {loadError}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function CommentForm({
  postId,
  viewer,
  onCreated,
}: {
  postId: string;
  viewer: NonNullable<Props["viewer"]>;
  onCreated: (c: Comment) => void;
}) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const text = content.trim();
    if (!text) return setError("Comment cannot be empty.");
    if (text.length > MAX) return setError(`Comments can be at most ${MAX} characters.`);
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api<Comment>(`/api/v1/posts/${postId}/comments`, {
        method: "POST",
        body: { content: text },
      });
      onCreated(data);
      setContent("");
      toast.success("Comment posted.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-3" noValidate>
      <UserAvatar user={viewer} className="mt-1" />
      <div className="flex-1">
        <label htmlFor="new-comment" className="sr-only">
          Write a comment
        </label>
        <Textarea
          id="new-comment"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Share your thoughts…"
          rows={3}
          maxLength={MAX}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "new-comment-error" : undefined}
          className="min-h-24 resize-y"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p
            id="new-comment-error"
            role={error ? "alert" : undefined}
            className="text-sm text-destructive"
          >
            {error}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular">
              {content.length}/{MAX}
            </span>
            <Button type="submit" disabled={submitting || !content.trim()}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Post comment
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  canManage,
  onUpdated,
  onDeleted,
}: {
  comment: Comment;
  canManage: boolean;
  onUpdated: (c: Comment) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const edited = new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime() > 1000;

  async function save() {
    const text = draft.trim();
    if (!text) return setError("Comment cannot be empty.");
    setSaving(true);
    setError(null);
    try {
      const { data } = await api<Comment>(`/api/v1/comments/${comment.id}`, {
        method: "PATCH",
        body: { content: text },
      });
      onUpdated(data);
      setEditing(false);
      toast.success("Comment updated.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await api(`/api/v1/comments/${comment.id}`, { method: "DELETE" });
      setConfirmOpen(false);
      onDeleted(comment.id);
      toast.success("Comment deleted.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="flex gap-3 py-6">
      <Link href={comment.author ? `/profile/${comment.author.username}` : "#"} className="shrink-0" tabIndex={-1}>
        <UserAvatar user={comment.author} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          {comment.author ? (
            <Link href={`/profile/${comment.author.username}`} className="font-medium hover:underline">
              {displayName(comment.author)}
            </Link>
          ) : (
            <span className="font-medium">Deleted user</span>
          )}
          <span className="text-muted-foreground" aria-hidden>
            ·
          </span>
          <time dateTime={comment.created_at} className="text-muted-foreground" suppressHydrationWarning>
            {timeAgo(comment.created_at)}
          </time>
          {edited ? <span className="text-xs text-muted-foreground">(edited)</span> : null}

          {canManage && !editing ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Comment options" />}
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {editing ? (
          <div className="mt-2">
            <label htmlFor={`edit-${comment.id}`} className="sr-only">
              Edit comment
            </label>
            <Textarea
              id={`edit-${comment.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={MAX}
              autoFocus
              aria-invalid={Boolean(error)}
            />
            {error ? (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="mt-2 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setDraft(comment.content);
                  setError(null);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={save} disabled={saving || !draft.trim()}>
                {saving ? <Loader2 className="animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 text-[0.95rem] leading-relaxed break-words whitespace-pre-line">{comment.content}</p>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
