export type PostStatus = "draft" | "published";

export type AuthorSummary = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type Profile = AuthorSummary & {
  bio: string | null;
  website_url: string | null;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type Tag = { id: string; name: string; slug: string };

/** Fields shown on article cards and lists. */
export type PostSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  status: PostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  reading_time: number;
  like_count: number;
  comment_count: number;
  author: AuthorSummary | null;
  category: Pick<Category, "name" | "slug"> | null;
};

export type PostDetail = PostSummary & {
  author_id: string;
  category_id: string | null;
  content_json: unknown;
  content_html: string;
  tags: Tag[];
};

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  author: AuthorSummary | null;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> };
export type ApiError = {
  error: { code: string; message: string; details?: unknown };
};
