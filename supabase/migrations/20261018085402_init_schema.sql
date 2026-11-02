-- BlogSpace schema: profiles, posts, comments, categories, tags, likes, bookmarks.
-- Authorization is enforced by Row Level Security (RLS) and column-level grants,
-- so it holds even when the Data API is called directly with the publishable key.

create extension if not exists citext with schema extensions;

-- Internal helpers live in a schema that is NOT exposed through the Data API.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-------------------------------------------------------------------------------
-- Generic triggers
-------------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-------------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique
    check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  display_name text check (char_length(display_name) <= 60),
  bio text check (char_length(bio) <= 300),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  website_url text check (website_url is null or website_url ~ '^https?://'),
  -- Authorization role. Users cannot write this column (see grants below).
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Is the current user an admin? SECURITY DEFINER so policies can read the role
-- without recursive RLS checks. Lives in the private (unexposed) schema.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- Create a profile automatically whenever someone signs up.
-- The requested username comes from sign-up metadata; it is sanitized and made
-- unique here, and it never influences authorization.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text;
  candidate text;
begin
  requested := regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^a-zA-Z0-9_]', '', 'g');
  if char_length(requested) < 3 then
    requested := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  candidate := left(requested, 30);

  -- lower() because citext operators are not on this function's empty search_path.
  if exists (select 1 from public.profiles where lower(username::text) = lower(candidate)) then
    candidate := left(requested, 23) || '_' || substr(md5(random()::text), 1, 6);
  end if;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    candidate,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-------------------------------------------------------------------------------
-- categories & tags
-------------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 50),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 300),
  created_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 30),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 40),
  created_at timestamptz not null default now()
);

-------------------------------------------------------------------------------
-- posts
-------------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  excerpt text check (char_length(excerpt) <= 300),
  content_json jsonb not null default '{}'::jsonb,
  content_html text not null default '' check (char_length(content_html) <= 200000),
  content_text text not null default '' check (char_length(content_text) <= 100000),
  cover_image_url text check (cover_image_url is null or cover_image_url ~ '^https://'),
  status text not null default 'draft' check (status in ('draft', 'published')),
  reading_time integer not null default 1 check (reading_time between 1 and 600),
  published_at timestamptz,
  -- Denormalized counters, maintained only by triggers.
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', left(coalesce(content_text, ''), 50000)), 'C')
  ) stored,
  constraint published_has_date check (status = 'draft' or published_at is not null)
);

create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_published_idx on public.posts (published_at desc) where status = 'published';
create index posts_popular_idx on public.posts (like_count desc, comment_count desc, published_at desc) where status = 'published';
create index posts_category_idx on public.posts (category_id, published_at desc) where status = 'published';
create index posts_search_idx on public.posts using gin (search);

-- Keep published_at consistent no matter how the row is written.
create or replace function private.posts_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published' or new.published_at is null) then
    new.published_at := coalesce(case when tg_op = 'UPDATE' then old.published_at end, now());
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    new.author_id := old.author_id; -- authorship can never be transferred
  end if;
  return new;
end;
$$;

create trigger posts_before_write
  before insert or update on public.posts
  for each row execute function private.posts_before_write();

create table public.post_tags (
  post_id uuid not null references public.posts (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (post_id, tag_id)
);
create index post_tags_tag_idx on public.post_tags (tag_id);

-------------------------------------------------------------------------------
-- comments (flat today; parent_id keeps replies possible later)
-- Deleting a parent comment deletes its replies (on delete cascade).
-------------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at desc);
create index comments_author_idx on public.comments (author_id);
create index comments_parent_idx on public.comments (parent_id);

create or replace function private.comments_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.post_id := old.post_id;
  new.author_id := old.author_id;
  new.parent_id := old.parent_id;
  return new;
end;
$$;
create trigger comments_before_update
  before update on public.comments
  for each row execute function private.comments_before_update();

-- A reply must belong to the same post as its parent. Checked in a trigger
-- (not the RLS policy) because a policy on comments that reads comments recurses.
create or replace function private.comments_check_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.comments c where c.id = new.parent_id and c.post_id = new.post_id
  ) then
    raise exception 'Parent comment must belong to the same post' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger comments_check_parent
  before insert on public.comments
  for each row execute function private.comments_check_parent();

-------------------------------------------------------------------------------
-- likes & bookmarks
-------------------------------------------------------------------------------
create table public.likes (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index likes_post_idx on public.likes (post_id);

create table public.bookmarks (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index bookmarks_user_idx on public.bookmarks (user_id, created_at desc);
create index bookmarks_post_idx on public.bookmarks (post_id);

-------------------------------------------------------------------------------
-- Counter triggers. SECURITY DEFINER because the liker is usually not the
-- post author and cannot update the post row. Not callable through the API.
-------------------------------------------------------------------------------
create or replace function private.bump_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger likes_count
  after insert or delete on public.likes
  for each row execute function private.bump_like_count();

create or replace function private.bump_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger comments_count
  after insert or delete on public.comments
  for each row execute function private.bump_comment_count();

revoke all on function private.bump_like_count() from public;
revoke all on function private.bump_comment_count() from public;
revoke all on function private.handle_new_user() from public;

-------------------------------------------------------------------------------
-- Grants. Column-level grants stop users from writing protected columns such
-- as profiles.role, posts.like_count or posts.author_id (on update).
-------------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

-- Start from nothing, then grant exactly what the app needs.
revoke all on all tables in schema public from anon, authenticated;

grant select on public.profiles, public.categories, public.tags, public.posts,
  public.post_tags, public.comments to anon, authenticated;
grant select on public.likes, public.bookmarks to authenticated;

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, display_name, bio, avatar_url, website_url) on public.profiles to authenticated;

revoke insert, update, delete on public.categories from anon, authenticated;

revoke insert, update, delete on public.tags from anon, authenticated;
grant insert (name, slug) on public.tags to authenticated;

revoke insert, update, delete on public.posts from anon, authenticated;
grant insert (author_id, category_id, title, slug, excerpt, content_json, content_html,
  content_text, cover_image_url, status, reading_time) on public.posts to authenticated;
grant update (category_id, title, slug, excerpt, content_json, content_html,
  content_text, cover_image_url, status, reading_time) on public.posts to authenticated;
grant delete on public.posts to authenticated;

revoke insert, update, delete on public.post_tags from anon, authenticated;
grant insert, delete on public.post_tags to authenticated;

revoke insert, update, delete on public.comments from anon, authenticated;
grant insert (post_id, author_id, parent_id, content) on public.comments to authenticated;
grant update (content) on public.comments to authenticated;
grant delete on public.comments to authenticated;

revoke all on public.likes, public.bookmarks from anon;
revoke update on public.likes, public.bookmarks from authenticated;
grant insert (user_id, post_id), delete on public.likes, public.bookmarks to authenticated;

-------------------------------------------------------------------------------
-- Row Level Security
-------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.posts enable row level security;
alter table public.post_tags enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.bookmarks enable row level security;

-- profiles: public read; owners update their own row (role is not writable).
create policy "Profiles are publicly readable" on public.profiles
  for select to anon, authenticated using (true);
create policy "Users update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- categories: public read only (managed by admins through SQL/dashboard).
create policy "Categories are publicly readable" on public.categories
  for select to anon, authenticated using (true);

-- tags: public read; signed-in users may create new tags.
create policy "Tags are publicly readable" on public.tags
  for select to anon, authenticated using (true);
create policy "Signed-in users create tags" on public.tags
  for insert to authenticated with check (true);

-- posts: published posts are public; drafts only for author or admin.
create policy "Published posts are public" on public.posts
  for select to anon, authenticated
  using (status = 'published');
create policy "Authors read their own posts" on public.posts
  for select to authenticated
  using ((select auth.uid()) = author_id or (select private.is_admin()));
create policy "Authors create their own posts" on public.posts
  for insert to authenticated
  with check ((select auth.uid()) = author_id);
create policy "Authors update their own posts" on public.posts
  for update to authenticated
  using ((select auth.uid()) = author_id or (select private.is_admin()))
  with check ((select auth.uid()) = author_id or (select private.is_admin()));
create policy "Authors delete their own posts" on public.posts
  for delete to authenticated
  using ((select auth.uid()) = author_id or (select private.is_admin()));

-- post_tags: visible when the post is visible; editable by the post's author.
create policy "Post tags follow post visibility" on public.post_tags
  for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "Authors tag their own posts" on public.post_tags
  for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));
create policy "Authors untag their own posts" on public.post_tags
  for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));

-- comments: readable when the post is readable; only on published posts;
-- authors edit/delete their own; admins can moderate (delete).
create policy "Comments follow post visibility" on public.comments
  for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "Signed-in users comment on published posts" on public.comments
  for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published')
  );
create policy "Authors edit their own comments" on public.comments
  for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);
create policy "Authors or admins delete comments" on public.comments
  for delete to authenticated
  using ((select auth.uid()) = author_id or (select private.is_admin()));

-- likes: users see and manage only their own likes, on published posts.
create policy "Users read their own likes" on public.likes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users like published posts" on public.likes
  for insert to authenticated
  with check ((select auth.uid()) = user_id
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published'));
create policy "Users remove their own likes" on public.likes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- bookmarks: private to each user.
create policy "Users read their own bookmarks" on public.bookmarks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users bookmark published posts" on public.bookmarks
  for insert to authenticated
  with check ((select auth.uid()) = user_id
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published'));
create policy "Users remove their own bookmarks" on public.bookmarks
  for delete to authenticated using ((select auth.uid()) = user_id);

-------------------------------------------------------------------------------
-- Reference data: categories (not user content).
-------------------------------------------------------------------------------
insert into public.categories (name, slug, description) values
  ('Technology', 'technology', 'Software, hardware, and the ideas shaping them.'),
  ('Programming', 'programming', 'Code, tools, and the craft of building software.'),
  ('Design', 'design', 'Interfaces, typography, and visual thinking.'),
  ('Science', 'science', 'Research, discovery, and how the world works.'),
  ('Business', 'business', 'Startups, careers, and the economics of work.'),
  ('Culture', 'culture', 'Books, film, music, and society.'),
  ('Lifestyle', 'lifestyle', 'Health, habits, and everyday life.'),
  ('Travel', 'travel', 'Places, journeys, and the people you meet.')
on conflict (slug) do nothing;
