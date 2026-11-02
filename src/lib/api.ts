import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

const NO_STORE = { "Cache-Control": "no-store" };

export function ok<T>(data: T, init?: { status?: number; meta?: Record<string, unknown> }) {
  const body = init?.meta ? { data, meta: init.meta } : { data };
  return NextResponse.json(body, { status: init?.status ?? 200, headers: NO_STORE });
}

export function noContent() {
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}

export function fail(
  code: ErrorCode,
  message: string,
  details?: unknown,
  headers?: Record<string, string>,
) {
  const error: { code: ErrorCode; message: string; details?: unknown } = { code, message };
  if (details !== undefined) error.details = details;
  return NextResponse.json({ error }, { status: STATUS[code], headers: { ...NO_STORE, ...headers } });
}

/** Field-level messages from a Zod error: { title: ["Title is required."] }. */
export function zodDetails(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export function validationError(error: ZodError) {
  return fail("VALIDATION_ERROR", "The submitted data is invalid.", zodDetails(error));
}

/** Reads a JSON body; returns undefined when it is missing or malformed. */
export async function readJson(request: Request, maxBytes = 300_000): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new PayloadTooLargeError();
  const text = await request.text();
  if (text.length > maxBytes) throw new PayloadTooLargeError();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export class PayloadTooLargeError extends Error {}

type PgError = { code?: string; message?: string } | null | undefined;

/**
 * Maps a database error to a safe API error without leaking internals.
 * Postgres codes: 23505 unique, 23503 FK, 23514 check, 42501 / PGRST RLS.
 */
export function dbError(error: PgError, context = "request") {
  const code = error?.code;
  if (code === "23505") return fail("CONFLICT", "That value is already taken.");
  if (code === "23503") return fail("BAD_REQUEST", "A referenced record does not exist.");
  if (code === "23514" || code === "22001" || code === "22P02")
    return fail("VALIDATION_ERROR", "The submitted data is invalid.");
  if (code === "42501") return fail("FORBIDDEN", "You do not have permission to do that.");
  console.error(`[api] ${context} failed`, error);
  return fail("INTERNAL_ERROR", "Something went wrong. Please try again.");
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}
