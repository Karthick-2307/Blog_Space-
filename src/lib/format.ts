const WORDS_PER_MINUTE = 225;

/** Turns text into a URL-safe slug: "Hello, World!" -> "hello-world". */
export function slugify(input: string, maxLength = 80): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug;
}

/** Short random suffix that keeps generated slugs unique. */
export function randomSuffix(length = 6): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function postSlug(title: string): string {
  const base = slugify(title, 100) || "post";
  return `${base}-${randomSuffix()}`;
}

export function countWords(text: string): number {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

/** Estimated reading time in whole minutes (minimum 1). */
export function readingTime(text: string): number {
  return Math.max(1, Math.ceil(countWords(text) / WORDS_PER_MINUTE));
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "3 minutes ago" style label; falls back to a date after a week. */
export function timeAgo(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 7) return rtf.format(-days, "day");
  return formatDate(date);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/[\s_]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(n);
}

export function displayName(p: { display_name: string | null; username: string } | null): string {
  if (!p) return "Unknown author";
  return p.display_name?.trim() || p.username;
}
