import Link from "next/link";
import { cn } from "@/lib/utils";

/** Plain serif wordmark. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("rounded-sm font-heading text-[1.4rem] leading-none font-semibold tracking-tight", className)}
      aria-label="BlogSpace home"
    >
      BlogSpace
    </Link>
  );
}
