/** Browser-side helper for calling the BlogSpace REST API. */
export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
      credentials: "same-origin",
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiRequestError(0, "NETWORK_ERROR", "Network error. Check your connection and try again.");
  }

  if (res.status === 204) return { data: undefined as T };

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON response.
  }

  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string; details?: Record<string, string[]> } })?.error;
    throw new ApiRequestError(
      res.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? `Request failed (${res.status}).`,
      error?.details,
    );
  }
  return body as { data: T; meta?: Record<string, unknown> };
}

export async function uploadImage(file: File, kind: "avatar" | "cover" | "inline"): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new ApiRequestError(413, "PAYLOAD_TOO_LARGE", "Images must be 5 MB or smaller.");
  const form = new FormData();
  form.set("file", file);
  form.set("kind", kind);
  let res: Response;
  try {
    res = await fetch("/api/v1/uploads", { method: "POST", body: form, credentials: "same-origin" });
  } catch {
    throw new ApiRequestError(0, "NETWORK_ERROR", "Upload failed. Check your connection.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiRequestError(res.status, body?.error?.code ?? "UNKNOWN", body?.error?.message ?? "Upload failed.");
  }
  return body.data.url as string;
}
