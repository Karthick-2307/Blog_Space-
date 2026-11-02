import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
      <p className="font-heading text-7xl font-semibold text-muted-foreground/40">404</p>
      <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        This page doesn&apos;t exist, was taken down by its author, or you don&apos;t have access to it.
      </p>
      <p className="mt-8 flex gap-6 text-sm">
        <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to the front page
        </Link>
        <Link href="/blog" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Browse articles
        </Link>
      </p>
    </div>
  );
}
