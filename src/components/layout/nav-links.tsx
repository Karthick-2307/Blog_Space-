"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLinks() {
  const pathname = usePathname();
  const params = useSearchParams();
  const onBlog = pathname === "/blog";
  const popular = onBlog && params.get("sort") === "popular";

  const links = [
    { href: "/blog", label: "Explore", active: onBlog && !popular },
    { href: "/blog?sort=popular", label: "Popular", active: popular },
  ];

  return (
    <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
      {links.map(({ href, label, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
            active && "text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
