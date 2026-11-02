"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

/**
 * Search, category and sort controls. They only change the URL; the server
 * reads the URL and runs the query, so results are always database-backed.
 */
export function BlogFilters({
  categories,
  showCategory = true,
}: {
  categories: Category[];
  showCategory?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  const sort = params.get("sort") === "popular" ? "popular" : "newest";
  const category = params.get("category") ?? "all";
  const tag = params.get("tag");

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    next.delete("focus");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Debounce typing so we query once the user pauses.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q.trim() === current) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    if (params.get("focus") === "search") inputRef.current?.focus();
  }, [params]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center" role="search">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <label htmlFor="blog-search" className="sr-only">
          Search articles
        </label>
        <Input
          ref={inputRef}
          id="blog-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") update({ q: q.trim() || null });
          }}
          placeholder="Search by title, excerpt or content…"
          className="h-10 pr-9 pl-9"
          maxLength={100}
        />
        {pending ? (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Loading results" />
        ) : null}
      </div>

      <div className="flex gap-3">
        {showCategory ? (
          <Select
            value={category}
            onValueChange={(v) => update({ category: !v || v === "all" ? null : String(v) })}
            items={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c.slug, label: c.name }))]}
          >
            <SelectTrigger className="min-w-40 flex-1 data-[size=default]:h-10 sm:flex-none" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <div className="inline-flex h-10 shrink-0 rounded-lg border border-border p-1" role="group" aria-label="Sort articles">
          {(["newest", "popular"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sort === s}
              onClick={() => update({ sort: s === "newest" ? null : s })}
              className={cn(
                "rounded-md px-3 text-sm capitalize text-muted-foreground transition-colors hover:text-foreground",
                sort === s && "bg-secondary text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {tag ? (
        <button
          type="button"
          onClick={() => update({ tag: null })}
          className="inline-flex h-10 items-center gap-1.5 self-start rounded-md border border-border px-3 text-sm sm:self-auto"
          aria-label={`Remove tag filter ${tag}`}
        >
          #{tag} <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
