import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** POST /auth/signout — ends the session and returns to the homepage. */
export async function POST(request: NextRequest) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
}
