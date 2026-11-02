"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-28 text-center" role="alert">
      <span className="mb-6 grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <h1 className="font-heading text-4xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-muted-foreground">
        We couldn&apos;t load this page. It may be a temporary problem — please try again.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      <Button className="mt-8" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
