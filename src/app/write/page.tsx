import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorSkeleton } from "@/components/editor/editor-skeleton";
import { PostEditor } from "@/components/editor/post-editor";
import { getAuth, requireViewer } from "@/lib/auth";
import { listCategories } from "@/lib/data/taxonomy";

export const metadata: Metadata = { title: "Write", robots: { index: false } };

export default function WritePage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <NewPost />
    </Suspense>
  );
}

async function NewPost() {
  await requireViewer("/write");
  const { supabase } = await getAuth();
  const categories = supabase ? await listCategories(supabase) : [];
  return <PostEditor post={null} categories={categories} />;
}
