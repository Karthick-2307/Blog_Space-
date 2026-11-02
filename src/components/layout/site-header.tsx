import Link from "next/link";
import { Suspense } from "react";
import { PenSquare, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getViewer } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/** Static header shell; the account area streams in because it reads cookies. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Logo />
        <Suspense fallback={null}>
          <NavLinks />
        </Suspense>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link
            href="/blog?focus=search"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            aria-label="Search articles"
          >
            <Search />
          </Link>
          <ThemeToggle />
          <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
            <AccountArea />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function AccountArea() {
  const viewer = await getViewer();
  return (
    <>
      {viewer ? (
        <>
          <Link
            href="/write"
            className={cn(buttonVariants({ variant: "ghost" }), "hidden gap-2 sm:inline-flex")}
          >
            <PenSquare /> Write
          </Link>
          <UserMenu viewer={viewer} />
        </>
      ) : (
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
            Sign in
          </Link>
          <Link href="/register" className={buttonVariants()}>
            Get started
          </Link>
        </div>
      )}
      <MobileNav viewer={viewer} />
    </>
  );
}
