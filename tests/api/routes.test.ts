/**
 * Route handler tests: authentication, validation, authorization and the
 * response format. The Supabase client is replaced by a fake (see
 * fake-supabase.ts); database-level rules are covered in tests/db.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, filterValue, type Responder } from "./fake-supabase";
import { resetRateLimits } from "@/lib/rate-limit";

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const POST_ID = "11111111-1111-4111-8111-111111111111";
const COMMENT_ID = "22222222-2222-4222-8222-222222222222";

let current: ReturnType<typeof fakeSupabase>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => current.client,
}));

function useSupabase(userId: string | null, respond: Responder = () => undefined) {
  current = fakeSupabase(userId, respond);
  return current;
}

const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });

function req(method: string, path: string, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const fullPost = (overrides: Record<string, unknown> = {}) => ({
  id: POST_ID,
  author_id: ALICE,
  title: "Hello",
  slug: "hello-abc123",
  status: "published",
  content_html: "<p>Plenty of words here to satisfy the publishing rule.</p>",
  post_tags: [],
  ...overrides,
});

beforeEach(() => {
  resetRateLimits();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/v1/posts", () => {
  it("requires authentication", async () => {
    useSupabase(null);
    const { POST } = await import("@/app/api/v1/posts/route");
    const res = await POST(req("POST", "/api/v1/posts", { title: "x", contentHtml: "" }), undefined);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "You need to sign in to do that." },
    });
  });

  it("validates the body and returns field errors", async () => {
    useSupabase(ALICE);
    const { POST } = await import("@/app/api/v1/posts/route");
    const res = await POST(req("POST", "/api/v1/posts", { title: "", contentHtml: "x", tags: Array(6).fill("t") }), undefined);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.title).toBeDefined();
    expect(body.error.details.tags).toBeDefined();
  });

  it("rejects malformed JSON", async () => {
    useSupabase(ALICE);
    const { POST } = await import("@/app/api/v1/posts/route");
    const bad = new Request("http://localhost/api/v1/posts", { method: "POST", body: "{not json" });
    const res = await POST(bad, undefined);
    expect(res.status).toBe(422);
  });

  it("refuses to publish an almost empty article", async () => {
    useSupabase(ALICE);
    const { POST } = await import("@/app/api/v1/posts/route");
    const res = await POST(req("POST", "/api/v1/posts", { title: "Hi", contentHtml: "<p>Short</p>", status: "published" }), undefined);
    expect(res.status).toBe(422);
  });

  it("creates a post for the signed-in user with sanitized HTML", async () => {
    const { calls } = useSupabase(ALICE, (call) => {
      if (call.table === "posts" && call.op === "insert") return { data: { id: POST_ID } };
      if (call.table === "posts" && call.op === "select") return { data: fullPost({ status: "draft" }) };
      return undefined;
    });
    const { POST } = await import("@/app/api/v1/posts/route");
    const res = await POST(
      req("POST", "/api/v1/posts", {
        title: "My first post",
        contentHtml: '<p onclick="steal()">Hi <script>alert(1)</script><a href="javascript:alert(1)">x</a></p>',
        status: "draft",
        authorId: BOB, // unknown fields are ignored; author always comes from the session
      }),
      undefined,
    );
    expect(res.status).toBe(201);
    const insert = calls.find((c) => c.table === "posts" && c.op === "insert")!;
    const row = insert.payload as Record<string, string>;
    expect(row.author_id).toBe(ALICE);
    expect(row.slug).toMatch(/^my-first-post-[a-z0-9]{6}$/);
    expect(row.content_html).not.toMatch(/script|onclick|javascript:/i);
    expect(row.content_text).toContain("Hi");
  });
});

describe("GET /api/v1/posts", () => {
  it("returns 404 for an unknown category", async () => {
    useSupabase(null, (call) => (call.table === "categories" ? { data: null } : undefined));
    const { GET } = await import("@/app/api/v1/posts/route");
    const res = await GET(req("GET", "/api/v1/posts?category=nope"), undefined);
    expect(res.status).toBe(404);
  });

  it("only queries published posts and returns pagination meta", async () => {
    const { calls } = useSupabase(null, (call) =>
      call.table === "posts" ? { data: [{ id: POST_ID, title: "A" }], count: 13 } : undefined,
    );
    const { GET } = await import("@/app/api/v1/posts/route");
    const res = await GET(req("GET", "/api/v1/posts?page=2&pageSize=12"), undefined);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta).toEqual({ page: 2, pageSize: 12, total: 13, totalPages: 2 });
    const query = calls.find((c) => c.table === "posts")!;
    expect(filterValue(query, "status")).toBe("published");
  });
});

describe("PATCH/DELETE /api/v1/posts/:id", () => {
  it("returns 404 for an invalid id", async () => {
    useSupabase(ALICE);
    const { PATCH } = await import("@/app/api/v1/posts/[id]/route");
    const res = await PATCH(req("PATCH", "/api/v1/posts/abc", { title: "x" }), ctx({ id: "abc" }));
    expect(res.status).toBe(404);
  });

  it("forbids editing someone else's post", async () => {
    const { calls } = useSupabase(BOB, (call) => (call.table === "posts" && call.op === "select" ? { data: fullPost() } : undefined));
    const { PATCH } = await import("@/app/api/v1/posts/[id]/route");
    const res = await PATCH(req("PATCH", `/api/v1/posts/${POST_ID}`, { title: "Hacked" }), ctx({ id: POST_ID }));
    expect(res.status).toBe(403);
    expect(calls.some((c) => c.op === "update")).toBe(false);
  });

  it("lets the author update their post", async () => {
    const { calls } = useSupabase(ALICE, (call) => {
      if (call.table === "posts" && call.op === "select") return { data: fullPost() };
      if (call.table === "posts" && call.op === "update") return { data: [{ id: POST_ID }] };
      return undefined;
    });
    const { PATCH } = await import("@/app/api/v1/posts/[id]/route");
    const res = await PATCH(req("PATCH", `/api/v1/posts/${POST_ID}`, { title: "Better title" }), ctx({ id: POST_ID }));
    expect(res.status).toBe(200);
    expect(calls.find((c) => c.op === "update")?.payload).toEqual({ title: "Better title" });
  });

  it("requires authentication to delete", async () => {
    useSupabase(null);
    const { DELETE } = await import("@/app/api/v1/posts/[id]/route");
    const res = await DELETE(req("DELETE", `/api/v1/posts/${POST_ID}`), ctx({ id: POST_ID }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when the database refuses the delete", async () => {
    useSupabase(BOB, (call) => {
      if (call.op === "select") return { data: fullPost() };
      if (call.op === "delete") return { data: [] }; // RLS: zero rows affected
      return undefined;
    });
    const { DELETE } = await import("@/app/api/v1/posts/[id]/route");
    const res = await DELETE(req("DELETE", `/api/v1/posts/${POST_ID}`), ctx({ id: POST_ID }));
    expect(res.status).toBe(403);
  });

  it("returns 204 when the author deletes", async () => {
    useSupabase(ALICE, (call) => {
      if (call.op === "select") return { data: fullPost() };
      if (call.op === "delete") return { data: [{ id: POST_ID }] };
      return undefined;
    });
    const { DELETE } = await import("@/app/api/v1/posts/[id]/route");
    const res = await DELETE(req("DELETE", `/api/v1/posts/${POST_ID}`), ctx({ id: POST_ID }));
    expect(res.status).toBe(204);
  });

  it("hides drafts the user cannot see (404, not 403)", async () => {
    useSupabase(BOB, () => ({ data: null }));
    const { GET } = await import("@/app/api/v1/posts/[id]/route");
    const res = await GET(req("GET", `/api/v1/posts/${POST_ID}`), ctx({ id: POST_ID }));
    expect(res.status).toBe(404);
  });
});

describe("comments", () => {
  it("a guest cannot comment", async () => {
    useSupabase(null);
    const { POST } = await import("@/app/api/v1/posts/[id]/comments/route");
    const res = await POST(req("POST", `/api/v1/posts/${POST_ID}/comments`, { content: "hi" }), ctx({ id: POST_ID }));
    expect(res.status).toBe(401);
  });

  it("rejects whitespace-only comments", async () => {
    useSupabase(ALICE);
    const { POST } = await import("@/app/api/v1/posts/[id]/comments/route");
    const res = await POST(req("POST", `/api/v1/posts/${POST_ID}/comments`, { content: "   " }), ctx({ id: POST_ID }));
    expect(res.status).toBe(422);
  });

  it("cannot comment on a draft", async () => {
    useSupabase(ALICE, (call) => (call.table === "posts" ? { data: { id: POST_ID, status: "draft" } } : undefined));
    const { POST } = await import("@/app/api/v1/posts/[id]/comments/route");
    const res = await POST(req("POST", `/api/v1/posts/${POST_ID}/comments`, { content: "hi" }), ctx({ id: POST_ID }));
    expect(res.status).toBe(404);
  });

  it("creates a comment as the signed-in user", async () => {
    const { calls } = useSupabase(BOB, (call) => {
      if (call.table === "posts") return { data: { id: POST_ID, status: "published" } };
      if (call.table === "comments" && call.op === "insert") return { data: { id: COMMENT_ID, content: "Nice" } };
      return undefined;
    });
    const { POST } = await import("@/app/api/v1/posts/[id]/comments/route");
    const res = await POST(req("POST", `/api/v1/posts/${POST_ID}/comments`, { content: "  Nice  " }), ctx({ id: POST_ID }));
    expect(res.status).toBe(201);
    expect(calls.find((c) => c.op === "insert")?.payload).toMatchObject({ author_id: BOB, content: "Nice" });
  });

  it("user A cannot edit user B's comment", async () => {
    useSupabase(ALICE, (call) => (call.op === "select" ? { data: { id: COMMENT_ID, author_id: BOB } } : undefined));
    const { PATCH } = await import("@/app/api/v1/comments/[id]/route");
    const res = await PATCH(req("PATCH", `/api/v1/comments/${COMMENT_ID}`, { content: "edited" }), ctx({ id: COMMENT_ID }));
    expect(res.status).toBe(403);
  });

  it("user A cannot delete user B's comment", async () => {
    useSupabase(ALICE, (call) => {
      if (call.op === "select") return { data: { id: COMMENT_ID } };
      if (call.op === "delete") return { data: [] };
      return undefined;
    });
    const { DELETE } = await import("@/app/api/v1/comments/[id]/route");
    const res = await DELETE(req("DELETE", `/api/v1/comments/${COMMENT_ID}`), ctx({ id: COMMENT_ID }));
    expect(res.status).toBe(403);
  });

  it("rate-limits rapid commenting", async () => {
    useSupabase(BOB, (call) => {
      if (call.table === "posts") return { data: { id: POST_ID, status: "published" } };
      return { data: { id: COMMENT_ID } };
    });
    const { POST } = await import("@/app/api/v1/posts/[id]/comments/route");
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await POST(req("POST", `/api/v1/posts/${POST_ID}/comments`, { content: `c${i}` }), ctx({ id: POST_ID }));
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe("likes, bookmarks, profiles", () => {
  it("a guest cannot like", async () => {
    useSupabase(null);
    const { POST } = await import("@/app/api/v1/posts/[id]/like/route");
    const res = await POST(req("POST", `/api/v1/posts/${POST_ID}/like`), ctx({ id: POST_ID }));
    expect(res.status).toBe(401);
  });

  it("liking is idempotent (upsert, ignore duplicates)", async () => {
    const { calls } = useSupabase(BOB, (call) => {
      if (call.table === "posts") return { data: { id: POST_ID, status: "published", like_count: 3 } };
      return undefined;
    });
    const { POST } = await import("@/app/api/v1/posts/[id]/like/route");
    const res = await POST(req("POST", `/api/v1/posts/${POST_ID}/like`), ctx({ id: POST_ID }));
    expect(res.status).toBe(201);
    const upsert = calls.find((c) => c.table === "likes");
    expect(upsert?.op).toBe("upsert");
    expect(upsert?.payload).toEqual({ user_id: BOB, post_id: POST_ID });
  });

  it("bookmarks list requires authentication", async () => {
    useSupabase(null);
    const { GET } = await import("@/app/api/v1/bookmarks/route");
    const res = await GET(req("GET", "/api/v1/bookmarks"), undefined);
    expect(res.status).toBe(401);
  });

  it("rejects attempts to change protected profile fields", async () => {
    const { calls } = useSupabase(BOB);
    const { PATCH } = await import("@/app/api/v1/profiles/me/route");
    const res = await PATCH(req("PATCH", "/api/v1/profiles/me", { role: "admin" }), undefined);
    expect(res.status).toBe(422);
    expect(calls.some((c) => c.op === "update")).toBe(false);
  });

  it("maps a taken username to 409", async () => {
    useSupabase(BOB, (call) => (call.op === "update" ? { error: { code: "23505", message: "dup" } } : undefined));
    const { PATCH } = await import("@/app/api/v1/profiles/me/route");
    const res = await PATCH(req("PATCH", "/api/v1/profiles/me", { username: "alice" }), undefined);
    expect(res.status).toBe(409);
  });

  it("does not leak internal database errors", async () => {
    useSupabase(null, () => ({ error: { code: "XX000", message: "relation secret_table does not exist" } }));
    const { GET } = await import("@/app/api/v1/categories/route");
    const res = await GET(req("GET", "/api/v1/categories"), undefined);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("secret_table");
  });
});

describe("uploads", () => {
  it("rejects files whose bytes are not an image, whatever the extension", async () => {
    useSupabase(ALICE);
    const { POST } = await import("@/app/api/v1/uploads/route");
    const form = new FormData();
    form.set("file", new File(["<script>alert(1)</script>"], "evil.png", { type: "image/png" }));
    form.set("kind", "cover");
    const res = await POST(new Request("http://localhost/api/v1/uploads", { method: "POST", body: form }), undefined);
    expect(res.status).toBe(415);
  });

  it("accepts a real PNG and stores it under the user's folder", async () => {
    useSupabase(ALICE);
    const { POST } = await import("@/app/api/v1/uploads/route");
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const form = new FormData();
    form.set("file", new File([png], "photo.jpg", { type: "image/jpeg" }));
    form.set("kind", "avatar");
    const res = await POST(new Request("http://localhost/api/v1/uploads", { method: "POST", body: form }), undefined);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.path).toMatch(new RegExp(`^${ALICE}/avatar/[0-9a-f-]+\\.png$`));
  });
});
