"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Viewer } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function MobileNav({ viewer }: { viewer: Viewer | null }) {
  const [open, setOpen] = useState(false);
  const links: [string, string][] = viewer
    ? [
        ["/blog", "Explore"],
        ["/write", "Write"],
        ["/dashboard", "Dashboard"],
        ["/bookmarks", "Bookmarks"],
        [`/profile/${viewer.username}`, "Profile"],
        ["/settings", "Settings"],
      ]
    : [
        ["/blog", "Explore"],
        ["/blog?sort=popular", "Popular"],
        ["/write", "Write"],
      ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />}
      >
        <Menu />
      </SheetTrigger>
      <SheetContent side="right" className="w-[85vw] max-w-sm">
        <SheetHeader>
          <SheetTitle className="font-heading text-lg">Menu</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4" aria-label="Mobile">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-3 text-base font-medium hover:bg-muted"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 p-4">
          {viewer ? (
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" className="h-11 w-full">
                Sign out
              </Button>
            </form>
          ) : (
            <>
              <Link href="/register" onClick={() => setOpen(false)} className={cn(buttonVariants(), "h-11")}>
                Get started
              </Link>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className={cn(buttonVariants({ variant: "outline" }), "h-11")}
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
