# BlogSpace

**Live site:** <https://blogspace-fawn.vercel.app>

BlogSpace is a full-stack blogging platform. People can register, write rich-text articles, publish them, comment, like, bookmark, and browse by search, category or tag.

**Stack:** Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), Tiptap, React Hook Form and Zod, and Supabase (Auth, Postgres with Row Level Security, Storage). Tests use Vitest, PGlite and Playwright.

## Features

- **Auth:** register, log in, log out, forgot and reset password. Sessions use cookies and are refreshed by `src/proxy.ts`.
- **Posts:** a rich-text editor (headings, lists, links, quotes, code, images), draft and publish, edit, and delete with a confirmation step. Covers, categories and up to 5 tags. Slugs are generated automatically, and the editor warns you before you leave with unsaved changes.
- **Reading:** server-rendered article pages with SEO metadata and JSON-LD, reading time, related articles, and an author card.
- **Comments:** add, edit and delete your own comments, with "load more" pagination.
- **Discovery:** full-text search (Postgres `tsvector`), category and tag filters, newest or popular sorting, and pagination.
- **Likes and bookmarks:** optimistic UI that rolls back if the server refuses. Bookmarks are private to each user.
- **Profiles, dashboard and settings:** a public author page; a dashboard with draft and published filters and engagement counts from the database; avatar upload.
- **REST API** under `/api/v1`. See [docs/API.md](docs/API.md).
- Dark theme by default with a light option, a responsive layout, keyboard focus styles, reduced-motion support, and skeleton, empty and error states.

## 1. Set up Supabase

1. Create a project at <https://supabase.com/dashboard>.
2. Apply the database migrations. Either:
   - **Dashboard:** open **SQL Editor** and run each file in `supabase/migrations/` in name order, or
   - **CLI:** `npx supabase login`, then `npx supabase link --project-ref <your-ref>`, then `npx supabase db push`.
3. **Authentication → URL Configuration:**
   - Site URL: `http://localhost:3000` (your production URL later).
   - Redirect URLs: add `http://localhost:3000/auth/callback` (and the production equivalent).
4. **Authentication → Providers → Email:** decide whether new users must confirm their email.
   - With confirmation **on**, users get an email and land on `/auth/callback`, which signs them in.
   - With it **off**, users are signed in right after registering. This is convenient for local testing and required for the end-to-end tests.
5. Optional: **Data API settings.** If your project does not expose new tables automatically, the migration's explicit `GRANT`s already cover the `anon` and `authenticated` roles.

## 2. Configure the app

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from **Project Settings → API**. Never put the service-role or secret key in this app; it isn't needed.

```bash
npm install
npm run dev        # http://localhost:3000
```

Until the variables are set, the site still runs and shows a "Database not connected" banner.

### Making someone an admin

Admins can delete any post or comment. Grant the role in the SQL editor (users cannot change it themselves):

```sql
update public.profiles set role = 'admin' where username = 'your_username';
```

## 3. Checks and tests

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates route types, then runs `tsc --noEmit` |
| `npm test` | Vitest: unit tests, API route tests, and database RLS tests (runs the real migrations in PGlite) |
| `npm run build` | Production build |
| `npm run test:e2e` | Playwright (run `npm run build` first; `npx playwright install chromium` once) |

Test layers:

- `tests/unit`: slugs, reading time, formatting, validation, sanitizing, rate limiting, image detection, safe redirects.
- `tests/api`: route handlers with a fake Supabase client. Covers 401, 403, 404, 409, 415, 422 and 429 responses, owner-only edits and deletes, sanitizing on save, and not leaking internal errors.
- `tests/db`: the actual migrations running in an in-memory Postgres. Two users and an anonymous visitor exercise every RLS policy: drafts stay private, nobody can edit another user's posts or comments, nobody can self-promote to admin, nobody can fake like counts, bookmarks stay private, and storage folders are owner-only.
- `tests/e2e/smoke.spec.ts`: public pages on desktop and mobile. These run without Supabase.
- `tests/e2e/full-flow.spec.ts`: register, draft, publish, comment, edit, a second user being blocked, likes and bookmarks, then delete. It needs a **separate test** Supabase project with email confirmation off:

  ```bash
  E2E_SUPABASE=1 npm run test:e2e
  ```

  Never run it against production data.

## 4. Deploy (Vercel)

1. Push the repo to GitHub and import it in Vercel.
2. Add the three environment variables from `.env.example`, with `NEXT_PUBLIC_SITE_URL` set to your domain.
3. In Supabase, add `https://your-domain/auth/callback` to the Redirect URLs and update the Site URL.

## Architecture notes

- **Where authorization lives:** the database. RLS policies plus column-level grants enforce every rule, so the rules hold even if someone calls the Supabase Data API directly with the publishable key. The API routes repeat the checks to return clear 401, 403 and 404 responses.
- **Drafts** are filtered by RLS (`status = 'published'` or you are the author) and by explicit `status` filters in the public queries.
- **Protected columns:** `profiles.role`, `posts.like_count`, `posts.comment_count`, `posts.published_at` and `posts.author_id` (on update) cannot be written by users. Triggers maintain the counters and `published_at`.
- **Rich text:** the editor stores Tiptap JSON plus HTML. The HTML is sanitized with an allow-list on save, and again when the page renders.
- **Uploads:** checked by magic bytes and size on the server, stored under `media/<user id>/…`, and the storage policies only allow writes to your own folder.
- **Comments** are flat in the UI. `parent_id` keeps replies possible later, and deleting a parent deletes its replies.
- **Caching:** Cache Components is enabled. Pages render a static shell and stream user-specific data inside `<Suspense>`. User data is never put in a shared cache.

### Known limitations

- Rate limits are kept in memory per server instance (see [docs/API.md](docs/API.md#rate-limits)).
- Saving a post's tags takes a few separate requests rather than one database transaction. If one step fails, the post is saved but its tags may need re-saving.
