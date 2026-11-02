import { describe, expect, it } from "vitest";
import { pageWindow } from "@/components/common/pagination";
import { dbError, fail, ok, zodDetails } from "@/lib/api";
import { buildPostRow, normalizeTags, publishProblems } from "@/lib/data/post-mutations";
import { countWords, displayName, formatDate, initials, postSlug, readingTime, slugify, timeAgo } from "@/lib/format";
import { detectImageType } from "@/lib/image";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";
import { safeNextPath } from "@/lib/redirect";
import { htmlToText, sanitizeArticleHtml } from "@/lib/sanitize";
import {
  commentInputSchema,
  listQuerySchema,
  postInputSchema,
  profileUpdateSchema,
  registerSchema,
} from "@/lib/validation";

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
    expect(slugify("  Crème brûlée & café  ")).toBe("creme-brulee-cafe");
    expect(slugify("---")).toBe("");
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(80);
  });

  it("adds a random suffix for post slugs", () => {
    expect(postSlug("My Post")).toMatch(/^my-post-[a-z0-9]{6}$/);
    expect(postSlug("!!!")).toMatch(/^post-[a-z0-9]{6}$/);
    expect(postSlug("Same")).not.toBe(postSlug("Same"));
  });
});

describe("reading time", () => {
  it("counts words and rounds up to whole minutes", () => {
    expect(countWords("  one two\nthree ")).toBe(3);
    expect(readingTime("")).toBe(1);
    expect(readingTime("word ".repeat(225))).toBe(1);
    expect(readingTime("word ".repeat(226))).toBe(2);
    expect(readingTime("word ".repeat(2250))).toBe(10);
  });
});

describe("formatting helpers", () => {
  it("formats dates", () => {
    expect(formatDate("2026-03-05T12:00:00Z")).toBe("Mar 5, 2026");
    expect(formatDate(null)).toBe("");
    expect(formatDate("not a date")).toBe("");
  });

  it("formats relative times", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    expect(timeAgo("2026-10-18T11:59:50Z", now)).toBe("just now");
    expect(timeAgo("2026-10-18T11:55:00Z", now)).toBe("5 minutes ago");
    expect(timeAgo("2026-10-18T09:00:00Z", now)).toBe("3 hours ago");
    expect(timeAgo("2026-10-01T09:00:00Z", now)).toBe("Oct 1, 2026");
  });

  it("builds initials and display names", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("grace_hopper")).toBe("GH");
    expect(initials(null)).toBe("?");
    expect(displayName({ display_name: "  ", username: "ada" })).toBe("ada");
    expect(displayName(null)).toBe("Unknown author");
  });

  it("computes the pagination window", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(5, 20)).toEqual([1, "…", 4, 5, 6, "…", 20]);
    expect(pageWindow(1, 20)).toEqual([1, 2, "…", 20]);
  });
});

describe("validation", () => {
  it("validates registration", () => {
    const good = { username: "ada_99", email: "ADA@Example.com ", password: "secret123", confirmPassword: "secret123" };
    const parsed = registerSchema.parse(good);
    expect(parsed.email).toBe("ada@example.com");
    expect(registerSchema.safeParse({ ...good, confirmPassword: "nope1234" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...good, username: "a b" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...good, password: "short1", confirmPassword: "short1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...good, password: "lettersonly", confirmPassword: "lettersonly" }).success).toBe(false);
  });

  it("validates posts", () => {
    expect(postInputSchema.safeParse({ title: "  ", contentHtml: "" }).success).toBe(false);
    expect(postInputSchema.safeParse({ title: "Ok", contentHtml: "", coverImageUrl: "http://x.com/a.png" }).success).toBe(false);
    expect(postInputSchema.safeParse({ title: "Ok", contentHtml: "", slug: "Bad Slug" }).success).toBe(false);
    const ok = postInputSchema.parse({ title: " Ok ", contentHtml: "<p>x</p>" });
    expect(ok).toMatchObject({ title: "Ok", status: "draft", tags: [] });
  });

  it("rejects whitespace-only comments", () => {
    expect(commentInputSchema.safeParse({ content: " \n\t " }).success).toBe(false);
    expect(commentInputSchema.parse({ content: "  hi  " }).content).toBe("hi");
    expect(commentInputSchema.safeParse({ content: "x".repeat(2001) }).success).toBe(false);
  });

  it("does not accept protected profile fields", () => {
    expect(profileUpdateSchema.safeParse({ role: "admin" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ bio: "Hi" }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ websiteUrl: "javascript:alert(1)" }).success).toBe(false);
  });

  it("falls back to safe list-query defaults", () => {
    expect(listQuerySchema.parse({ page: "-3", pageSize: "500", sort: "weird" })).toMatchObject({
      page: 1,
      pageSize: 12,
      sort: "newest",
    });
  });
});

describe("HTML sanitizing", () => {
  it("removes scripts, handlers and dangerous URLs", () => {
    const dirty =
      '<h1>Title</h1><p onclick="x()" style="color:red">Hi<script>alert(1)</script></p>' +
      '<a href="javascript:alert(1)">bad</a><a href="https://ok.com">good</a>' +
      '<img src="http://insecure.com/a.png"><img src="https://ok.com/a.png" alt="A" onerror="x()"><iframe src="https://evil"></iframe>';
    const clean = sanitizeArticleHtml(dirty);
    expect(clean).not.toMatch(/script|onclick|onerror|style=|javascript:|iframe|insecure/i);
    expect(clean).toContain("<h2>Title</h2>");
    expect(clean).toContain('href="https://ok.com"');
    expect(clean).toContain('rel="noopener noreferrer nofollow ugc"');
    expect(clean).toContain('src="https://ok.com/a.png"');
  });

  it("extracts plain text", () => {
    expect(htmlToText("<p>Hello&nbsp;<strong>world</strong></p><p>Again &amp; again</p>")).toBe(
      "Hello world Again & again",
    );
  });
});

describe("post rows", () => {
  it("builds a sanitized row with derived fields", () => {
    const row = buildPostRow({ title: "T", excerpt: null, contentHtml: "<p>" + "word ".repeat(450) + "</p>" });
    expect(row.reading_time).toBe(2);
    expect(String(row.excerpt).length).toBeLessThanOrEqual(201);
  });

  it("requires content to publish", () => {
    expect(publishProblems({ status: "published", content_text: "short" })).not.toBeNull();
    expect(publishProblems({ status: "draft", content_text: "" })).toBeNull();
  });

  it("normalizes and de-duplicates tags", () => {
    expect(normalizeTags(["React", " react ", "Next.js", "", "#!"]).map((t) => t.slug)).toEqual(["react", "next-js"]);
  });
});

describe("API responses", () => {
  it("uses a consistent success and error shape", async () => {
    const s = ok({ a: 1 }, { meta: { page: 1 } });
    expect(await s.json()).toEqual({ data: { a: 1 }, meta: { page: 1 } });
    expect(s.headers.get("cache-control")).toBe("no-store");
    const e = fail("NOT_FOUND", "Nope");
    expect(e.status).toBe(404);
    expect(await e.json()).toEqual({ error: { code: "NOT_FOUND", message: "Nope" } });
  });

  it("maps database errors safely", async () => {
    expect(dbError({ code: "23505" }).status).toBe(409);
    expect(dbError({ code: "42501" }).status).toBe(403);
    const unknown = dbError({ code: "XX", message: "secret detail" });
    expect(unknown.status).toBe(500);
    expect(JSON.stringify(await unknown.json())).not.toContain("secret");
  });

  it("formats zod issues per field", () => {
    const r = postInputSchema.safeParse({ title: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(zodDetails(r.error))).toEqual(expect.arrayContaining(["title", "contentHtml"]));
  });
});

describe("rate limiter", () => {
  it("allows up to the limit per window", () => {
    resetRateLimits();
    const t = 1_000_000;
    expect(rateLimit("k", 2, 1000, t).allowed).toBe(true);
    expect(rateLimit("k", 2, 1000, t + 1).allowed).toBe(true);
    const blocked = rateLimit("k", 2, 1000, t + 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    expect(rateLimit("k", 2, 1000, t + 1001).allowed).toBe(true);
    expect(rateLimit("other", 2, 1000, t + 2).allowed).toBe(true);
  });
});

describe("image detection", () => {
  it("detects real image types from bytes", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe("image/png");
    expect(detectImageType(new TextEncoder().encode("GIF89a...."))?.mime).toBe("image/gif");
    expect(detectImageType(new TextEncoder().encode("RIFF1234WEBPVP8 "))?.mime).toBe("image/webp");
    expect(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});

describe("redirect safety", () => {
  it("only allows same-site paths", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath(null, "/x")).toBe("/x");
  });
});
