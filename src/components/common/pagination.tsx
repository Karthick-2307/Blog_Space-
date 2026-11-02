import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Link-based pagination that keeps the other query parameters. */
export function Pagination({
  page,
  totalPages,
  basePath,
  params = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const pages = pageWindow(page, totalPages);

  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-1">
      <PageLink href={page > 1 ? href(page - 1) : null} label="Previous page">
        <ChevronLeft /> <span className="hidden sm:inline">Previous</span>
      </PageLink>
      <ul className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === "…" ? (
            <li key={`gap-${i}`} className="px-2 text-muted-foreground" aria-hidden>
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={href(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  buttonVariants({ variant: p === page ? "secondary" : "ghost", size: "icon" }),
                  "tabular",
                )}
              >
                {p}
              </Link>
            </li>
          ),
        )}
      </ul>
      <PageLink href={page < totalPages ? href(page + 1) : null} label="Next page">
        <span className="hidden sm:inline">Next</span> <ChevronRight />
      </PageLink>
    </nav>
  );
}

function PageLink({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const cls = cn(buttonVariants({ variant: "ghost" }), "gap-1");
  if (!href)
    return (
      <span aria-disabled className={cn(cls, "pointer-events-none opacity-40")}>
        {children}
      </span>
    );
  return (
    <Link href={href} aria-label={label} className={cls}>
      {children}
    </Link>
  );
}

export function pageWindow(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}
