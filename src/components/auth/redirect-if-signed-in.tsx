import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

/** Sends signed-in users away from the login and register pages. */
export async function RedirectIfSignedIn({ to = "/dashboard" }: { to?: string }) {
  const { userId } = await getAuth();
  if (userId) redirect(to);
  return null;
}
