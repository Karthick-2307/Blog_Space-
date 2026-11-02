import { reactionHandlers } from "@/lib/reactions";

const handlers = reactionHandlers("bookmarks");

/** POST adds it for the current user; DELETE removes it. Both are idempotent. */
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
