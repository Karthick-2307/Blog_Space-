/**
 * Runs the real migrations in an in-memory Postgres (PGlite) and checks the
 * Row Level Security rules with two separate users and an anonymous visitor.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, signUp, type TestDb } from "./harness";

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";

let db: TestDb;
let alicePublished: string;
let aliceDraft: string;

async function createPost(userId: string, title: string, status: "draft" | "published") {
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2, 8)}`;
  const rows = await as<{ id: string }>(
    db,
    userId,
    `insert into public.posts (author_id, title, slug, content_html, content_text, status)
     values ($1, $2, $3, '<p>Hello</p>', 'Hello world, this is enough text to publish.', $4) returning id`,
    [userId, title, slug, status],
  );
  return rows[0].id;
}

async function expectDenied(promise: Promise<unknown>) {
  await expect(promise).rejects.toThrow(/permission denied|row-level security|violates/i);
}

beforeAll(async () => {
  db = await createTestDb();
  await signUp(db, ALICE, "alice");
  await signUp(db, BOB, "bob");
  alicePublished = await createPost(ALICE, "Alice public", "published");
  aliceDraft = await createPost(ALICE, "Alice secret draft", "draft");
});

describe("schema & triggers", () => {
  it("creates a profile for each new auth user", async () => {
    const rows = await as(db, null, `select username from public.profiles order by username`);
    expect(rows.map((r) => r.username)).toEqual(["alice", "bob"]);
  });

  it("makes duplicate usernames unique instead of failing sign-up", async () => {
    await signUp(db, "00000000-0000-4000-8000-0000000000cc", "ALICE");
    const rows = await as<{ username: string }>(
      db,
      null,
      `select username from public.profiles where id = '00000000-0000-4000-8000-0000000000cc'`,
    );
    expect(rows[0].username).toMatch(/^ALICE_[0-9a-f]{6}$/);
  });

  it("sets published_at automatically when publishing", async () => {
    const rows = await as<{ published_at: string | null }>(
      db,
      ALICE,
      `select published_at from public.posts where id in ($1, $2) order by status desc`,
      [alicePublished, aliceDraft],
    );
    expect(rows[0].published_at).not.toBeNull(); // published
    expect(rows[1].published_at).toBeNull(); // draft
  });

  it("seeds categories", async () => {
    const rows = await as(db, null, `select count(*)::int as n from public.categories`);
    expect(rows[0].n).toBe(8);
  });
});

describe("posts", () => {
  it("anonymous visitors see published posts but not drafts", async () => {
    const rows = await as<{ id: string }>(db, null, `select id from public.posts`);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(alicePublished);
    expect(ids).not.toContain(aliceDraft);
  });

  it("a user cannot read another user's draft", async () => {
    const rows = await as(db, BOB, `select id from public.posts where id = $1`, [aliceDraft]);
    expect(rows).toHaveLength(0);
  });

  it("an author can read their own draft", async () => {
    const rows = await as(db, ALICE, `select id from public.posts where id = $1`, [aliceDraft]);
    expect(rows).toHaveLength(1);
  });

  it("a guest cannot create a post", async () => {
    await expectDenied(
      as(db, null, `insert into public.posts (author_id, title, slug) values ($1, 'x', 'guest-post')`, [ALICE]),
    );
  });

  it("a user cannot create a post in someone else's name", async () => {
    await expectDenied(
      as(db, BOB, `insert into public.posts (author_id, title, slug) values ($1, 'Fake', 'fake-post')`, [ALICE]),
    );
  });

  it("user B cannot edit or delete user A's post", async () => {
    const updated = await as(db, BOB, `update public.posts set title = 'Hacked' where id = $1 returning id`, [
      alicePublished,
    ]);
    expect(updated).toHaveLength(0);
    const deleted = await as(db, BOB, `delete from public.posts where id = $1 returning id`, [alicePublished]);
    expect(deleted).toHaveLength(0);
    const rows = await as<{ title: string }>(db, null, `select title from public.posts where id = $1`, [alicePublished]);
    expect(rows[0].title).toBe("Alice public");
  });

  it("an author cannot fake engagement counters", async () => {
    await expectDenied(as(db, ALICE, `update public.posts set like_count = 9999 where id = $1`, [alicePublished]));
  });

  it("authorship cannot be transferred", async () => {
    await expectDenied(as(db, ALICE, `update public.posts set author_id = $2 where id = $1`, [alicePublished, BOB]));
  });

  it("rejects invalid data via constraints", async () => {
    await expect(
      as(db, ALICE, `insert into public.posts (author_id, title, slug) values ($1, '   ', 'blank-title')`, [ALICE]),
    ).rejects.toThrow(/check constraint/i);
    await expect(
      as(db, ALICE, `insert into public.posts (author_id, title, slug) values ($1, 'Ok', 'Bad Slug!')`, [ALICE]),
    ).rejects.toThrow(/check constraint/i);
  });

  it("full-text search finds published posts", async () => {
    const rows = await as(
      db,
      null,
      `select id from public.posts where search @@ websearch_to_tsquery('english', 'alice')`,
    );
    expect(rows.map((r) => r.id)).toEqual([alicePublished]);
  });
});

describe("profiles", () => {
  it("a user cannot grant themselves admin", async () => {
    await expectDenied(as(db, BOB, `update public.profiles set role = 'admin' where id = $1`, [BOB]));
  });

  it("a user cannot edit someone else's profile", async () => {
    const rows = await as(db, BOB, `update public.profiles set bio = 'pwned' where id = $1 returning id`, [ALICE]);
    expect(rows).toHaveLength(0);
  });

  it("a user can edit their own bio", async () => {
    const rows = await as(db, BOB, `update public.profiles set bio = 'Hi!' where id = $1 returning bio`, [BOB]);
    expect(rows[0].bio).toBe("Hi!");
  });
});

describe("comments", () => {
  let aliceComment: string;

  it("a guest cannot comment", async () => {
    await expectDenied(
      as(db, null, `insert into public.comments (post_id, author_id, content) values ($1, $2, 'hi')`, [
        alicePublished,
        ALICE,
      ]),
    );
  });

  it("users can comment on published posts and the counter updates", async () => {
    const rows = await as<{ id: string }>(
      db,
      ALICE,
      `insert into public.comments (post_id, author_id, content) values ($1, $2, 'First!') returning id`,
      [alicePublished, ALICE],
    );
    aliceComment = rows[0].id;
    const post = await as(db, null, `select comment_count from public.posts where id = $1`, [alicePublished]);
    expect(post[0].comment_count).toBe(1);
  });

  it("nobody can comment on a draft", async () => {
    await expectDenied(
      as(db, ALICE, `insert into public.comments (post_id, author_id, content) values ($1, $2, 'x')`, [
        aliceDraft,
        ALICE,
      ]),
    );
  });

  it("rejects empty comments", async () => {
    await expect(
      as(db, BOB, `insert into public.comments (post_id, author_id, content) values ($1, $2, '   ')`, [
        alicePublished,
        BOB,
      ]),
    ).rejects.toThrow(/check constraint/i);
  });

  it("user B cannot edit or delete user A's comment", async () => {
    const upd = await as(db, BOB, `update public.comments set content = 'edited' where id = $1 returning id`, [
      aliceComment,
    ]);
    expect(upd).toHaveLength(0);
    const del = await as(db, BOB, `delete from public.comments where id = $1 returning id`, [aliceComment]);
    expect(del).toHaveLength(0);
  });

  it("the author can edit and delete their comment", async () => {
    const upd = await as<{ content: string }>(
      db,
      ALICE,
      `update public.comments set content = 'Edited' where id = $1 returning content`,
      [aliceComment],
    );
    expect(upd[0].content).toBe("Edited");
    const del = await as(db, ALICE, `delete from public.comments where id = $1 returning id`, [aliceComment]);
    expect(del).toHaveLength(1);
    const post = await as(db, null, `select comment_count from public.posts where id = $1`, [alicePublished]);
    expect(post[0].comment_count).toBe(0);
  });

  it("comments on drafts are hidden from other users", async () => {
    const rows = await as(db, BOB, `select id from public.comments where post_id = $1`, [aliceDraft]);
    expect(rows).toHaveLength(0);
  });
});

describe("likes & bookmarks", () => {
  it("likes update the counter and cannot be duplicated", async () => {
    await as(db, BOB, `insert into public.likes (user_id, post_id) values ($1, $2)`, [BOB, alicePublished]);
    await expect(
      as(db, BOB, `insert into public.likes (user_id, post_id) values ($1, $2)`, [BOB, alicePublished]),
    ).rejects.toThrow(/duplicate key/i);
    const post = await as(db, null, `select like_count from public.posts where id = $1`, [alicePublished]);
    expect(post[0].like_count).toBe(1);
  });

  it("a user cannot like on behalf of someone else", async () => {
    await expectDenied(
      as(db, BOB, `insert into public.likes (user_id, post_id) values ($1, $2)`, [ALICE, alicePublished]),
    );
  });

  it("drafts cannot be liked or bookmarked", async () => {
    await expectDenied(as(db, BOB, `insert into public.likes (user_id, post_id) values ($1, $2)`, [BOB, aliceDraft]));
    await expectDenied(
      as(db, BOB, `insert into public.bookmarks (user_id, post_id) values ($1, $2)`, [BOB, aliceDraft]),
    );
  });

  it("bookmarks are private to their owner", async () => {
    await as(db, BOB, `insert into public.bookmarks (user_id, post_id) values ($1, $2)`, [BOB, alicePublished]);
    const alice = await as(db, ALICE, `select * from public.bookmarks`);
    expect(alice).toHaveLength(0);
    const bob = await as(db, BOB, `select * from public.bookmarks`);
    expect(bob).toHaveLength(1);
    await expectDenied(as(db, null, `select * from public.bookmarks`));
  });

  it("a user cannot delete someone else's bookmark", async () => {
    const rows = await as(db, ALICE, `delete from public.bookmarks where user_id = $1 returning post_id`, [BOB]);
    expect(rows).toHaveLength(0);
  });
});

describe("tags", () => {
  it("a user cannot tag someone else's post", async () => {
    const [tag] = await as<{ id: string }>(
      db,
      BOB,
      `insert into public.tags (name, slug) values ('Spam', 'spam') returning id`,
    );
    await expectDenied(
      as(db, BOB, `insert into public.post_tags (post_id, tag_id) values ($1, $2)`, [alicePublished, tag.id]),
    );
    await as(db, ALICE, `insert into public.post_tags (post_id, tag_id) values ($1, $2)`, [alicePublished, tag.id]);
    const rows = await as(db, null, `select * from public.post_tags where post_id = $1`, [alicePublished]);
    expect(rows).toHaveLength(1);
  });
});

describe("storage", () => {
  it("users can only upload into their own folder", async () => {
    await as(db, BOB, `insert into storage.objects (bucket_id, name) values ('media', $1)`, [`${BOB}/cover/a.png`]);
    await expectDenied(
      as(db, BOB, `insert into storage.objects (bucket_id, name) values ('media', $1)`, [`${ALICE}/cover/b.png`]),
    );
  });
});
