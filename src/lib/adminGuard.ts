import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

/** Returns the session if the caller is a signed-in admin, otherwise null. */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

/** For server-rendered admin pages: redirect anyone who isn't a signed-in admin, independent of middleware. */
export async function assertAdmin() {
  const session = await requireAdmin();
  if (!session) redirect("/login");
  return session;
}
