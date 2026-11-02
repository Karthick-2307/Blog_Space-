import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShieldX } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { EditorSkeleton } from "@/components/editor/editor-skeleton";
import { PostEditor } from "@/components/editor/post-editor";
import { getAuth, requireViewer } from "@/lib/auth";
import { getPostById } from "@/lib/data/posts";
import { listCategories } from "@/lib/data/taxonomy";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit article", robots: { index: false } };

export default function EditPostPage({ params }: PageProps<"/write/[id]">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditPost params={params} />
    </Suspense>
  );
}

async function EditPost({ params }: { params: PageProps<"/write/[id]">["params"] }) {
  const { id } = await params;
  const viewer = await requireViewer(`/write/${id}`);
  if (!uuidSchema.safeParse(id).success) notFound();

  const { supabase } = await getAuth();
  if (!supabase) notFound();
  const [post, categories] = await Promise.all([getPostById(supabase, id), listCategories(supabase)]);

  // RLS hides other people's drafts, so those look like "not found".
  if (!post) notFound();
  if (post.author_id !== viewer.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <EmptyState
          icon={ShieldX}
          title="You can't edit this article"
          description="Only the author of an article can edit it."
        />
      </div>
    );
  }
  return <PostEditor post={post} categories={categories} />;
}
