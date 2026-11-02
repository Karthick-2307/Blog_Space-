# BlogSpace REST API (v1)

Base path: `/api/v1`. All responses are JSON and are never cached (`Cache-Control: no-store`).

Authentication uses the Supabase session cookie set when you sign in on the site. Requests from the browser send it automatically. Every protected endpoint checks the signed-in user on the server, and the database enforces the same rules with Row Level Security.

## Response format

Success:

```json
{ "data": { }, "meta": { "page": 1, "pageSize": 12, "total": 40, "totalPages": 4 } }
```

`meta` appears only on list endpoints.

Error:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "The submitted data is invalid.", "details": { "title": ["Title is required."] } } }
```

| Code | HTTP | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 422 | The body or parameters failed validation. `details` lists messages per field. |
| `BAD_REQUEST` | 400 | The request is malformed. |
| `UNAUTHORIZED` | 401 | You need to sign in. |
| `FORBIDDEN` | 403 | You are signed in but are not allowed to do this. |
| `NOT_FOUND` | 404 | The resource does not exist or you cannot see it. Other users' drafts return 404. |
| `CONFLICT` | 409 | A unique value is taken, such as a slug or username. |
| `PAYLOAD_TOO_LARGE` | 413 | The body or upload is too large. |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | The upload is not a JPEG, PNG, WebP or GIF image. |
| `RATE_LIMITED` | 429 | Too many requests. Check the `Retry-After` header. |
| `SERVICE_UNAVAILABLE` | 503 | Supabase is not configured. |
| `INTERNAL_ERROR` | 500 | An unexpected error. Internal details are never returned. |

## Posts

### `GET /posts` (public)

Lists published posts only.

| Query | Default | Notes |
| --- | --- | --- |
| `page` | 1 | 1-based page number |
| `pageSize` | 12 | 1 to 50 |
| `q` | | Full-text search over title, excerpt and content (Postgres `websearch` syntax) |
| `category` | | Category slug |
| `tag` | | Tag slug |
| `sort` | `newest` | `newest` or `popular` (sorted by likes, then comments) |

Returns `404` when `category` or `tag` does not exist.

### `POST /posts` (signed in)

Creates a post for the current user. The author always comes from the session; any author field in the body is ignored.

```json
{
  "title": "My first post",
  "excerpt": "Optional subtitle (max 300)",
  "contentJson": { "type": "doc", "content": [] },
  "contentHtml": "<p>Article HTML</p>",
  "coverImageUrl": "https://…/storage/v1/object/public/media/…",
  "categoryId": "uuid or null",
  "tags": ["react", "nextjs"],
  "status": "draft",
  "slug": "optional-custom-slug"
}
```

- The server sanitizes `contentHtml` with an allow-list and also derives the plain text, reading time and a fallback excerpt from it.
- When `slug` is left out, it is generated from the title plus a random suffix.
- Publishing requires at least a few sentences of content.
- You can use at most 5 tags. Tags that don't exist yet are created.

Returns `201` with the created post.

### `GET /posts/:id`

Returns a published post. Its author (or an admin) can also fetch it while it is a draft. Everyone else gets `404` for drafts.

### `PATCH /posts/:id` (author only)

Partial update with the same fields as `POST`. Only the fields you send are changed. Returns `403` when you are not the author.

### `DELETE /posts/:id` (author or admin)

Returns `204`. Deleting a post also removes its comments, likes, bookmarks and tag links.

## Comments

### `GET /posts/:id/comments`

Lists comments newest first. Query: `page` and `pageSize` (default 20, max 50). Returns `404` when you cannot see the post.

### `POST /posts/:id/comments` (signed in)

Body: `{ "content": "1–2000 chars", "parentId": "optional uuid" }`. Whitespace-only comments are rejected. You can only comment on published posts. Returns `201` with the comment and its author.

### `PATCH /comments/:id` (comment author only)

Body: `{ "content": "…" }`.

### `DELETE /comments/:id` (comment author or admin)

Returns `204`. Deleting a parent comment also deletes its replies.

## Likes and bookmarks

| Method and path | Auth | Result |
| --- | --- | --- |
| `POST /posts/:id/like` | signed in | `201` `{ postId, liked: true, likeCount }`. Liking twice does not create a duplicate. |
| `DELETE /posts/:id/like` | signed in | `200` `{ postId, liked: false, likeCount }` |
| `POST /posts/:id/bookmark` | signed in | `201` `{ postId, bookmarked: true }` |
| `DELETE /posts/:id/bookmark` | signed in | `200` `{ postId, bookmarked: false }` |
| `GET /bookmarks` | signed in | The current user's bookmarked posts, paginated |

You can only like or bookmark published posts.

## Profiles

### `GET /profiles/:username` (public)

Returns public profile fields and `postCount`, the number of published posts.

### `GET /profiles/me` (signed in)

### `PATCH /profiles/me` (signed in)

Body (all fields optional): `username`, `displayName`, `bio`, `websiteUrl`, `avatarUrl`. Unknown fields such as `role` are rejected with `422`, and the database also refuses writes to `role`. A taken username returns `409`.

## Categories, tags and uploads

- `GET /categories` lists all categories.
- `GET /tags` lists tags alphabetically (up to 60).
- `POST /uploads` (signed in) accepts `multipart/form-data` with `file` and `kind` (`avatar`, `cover` or `inline`). The server checks the file's actual bytes, not its name or the browser's content type, and allows JPEG, PNG, WebP and GIF up to 5 MB. It returns `201` `{ url, path }`, and files are stored under `media/<user id>/<kind>/`.

## Rate limits

Mutation endpoints are rate-limited per user: posts 30/hour, comments 10/minute, likes and bookmarks 60/minute, uploads 20/hour, profile updates 20/hour.

The limiter keeps its counts in memory on each server instance. On serverless hosting with several instances, the limits are per instance, not global. For strict global limits, move the counters to a shared store such as Redis.
