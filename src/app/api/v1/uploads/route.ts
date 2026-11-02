import { fail, ok } from "@/lib/api";
import { detectImageType, MAX_IMAGE_BYTES } from "@/lib/image";
import { LIMITS } from "@/lib/rate-limit";
import { limited, route, unauthorized } from "@/lib/route";

const KINDS = new Set(["avatar", "cover", "inline"]);

/**
 * POST /api/v1/uploads — multipart form with `file` and `kind`.
 * Stores the image under media/<user id>/<kind>/ and returns its public URL.
 */
export const POST = route(async (req, _ctx: unknown, { supabase, userId }) => {
  if (!userId) return unauthorized();
  const rl = limited(`upload:${userId}`, LIMITS.upload);
  if (rl) return rl;

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_IMAGE_BYTES + 64 * 1024) return fail("PAYLOAD_TOO_LARGE", "Images must be 5 MB or smaller.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("BAD_REQUEST", "Send the image as multipart/form-data.");
  }

  const file = form.get("file");
  const kind = String(form.get("kind") ?? "inline");
  if (!KINDS.has(kind)) return fail("VALIDATION_ERROR", "Unknown upload kind.");
  if (!(file instanceof File) || file.size === 0) return fail("VALIDATION_ERROR", "Choose an image to upload.");
  if (file.size > MAX_IMAGE_BYTES) return fail("PAYLOAD_TOO_LARGE", "Images must be 5 MB or smaller.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return fail("UNSUPPORTED_MEDIA_TYPE", "Only JPEG, PNG, WebP and GIF images are allowed.");

  const path = `${userId}/${kind}/${crypto.randomUUID()}.${type.ext}`;
  const { error } = await supabase.storage.from("media").upload(path, bytes, {
    contentType: type.mime,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    console.error("[api] upload failed", error);
    return fail("INTERNAL_ERROR", "The image could not be uploaded. Please try again.");
  }

  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return ok({ url: data.publicUrl, path }, { status: 201 });
});
