import Link from "next/link";
import { Logo } from "./logo";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Read",
    links: [
      ["/blog", "Explore articles"],
      ["/blog?sort=popular", "Popular"],
      ["/category/technology", "Technology"],
      ["/category/design", "Design"],
    ],
  },
  {
    title: "Write",
    links: [
      ["/write", "New post"],
      ["/dashboard", "Dashboard"],
      ["/bookmarks", "Bookmarks"],
    ],
  },
  {
    title: "Account",
    links: [
      ["/login", "Sign in"],
      ["/register", "Create account"],
      ["/settings", "Settings"],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Articles, notes and comments from the people who write here.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="space-y-3">
            <h2 className="text-sm font-medium">{col.title}</h2>
            <ul className="space-y-2">
              {col.links.map(([href, label]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border/60">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6">
          © BlogSpace
        </p>
      </div>
    </footer>
  );
}
