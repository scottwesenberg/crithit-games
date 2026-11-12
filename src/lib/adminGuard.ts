import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasTwoFactor } from "@/lib/twoFactor";

/** Where admins without 2FA are sent to set it up. */
export const ADMIN_2FA_SETUP_PATH = "/account/security?required=1";

/**
 * Returns the session if the caller is a signed-in admin who has two-factor authentication turned on,
 * otherwise null. Admin API routes use this, so an admin without 2FA can't use them.
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, totpEnabled: true, emailOtpEnabled: true },
  });
  if (!user || user.role !== "ADMIN" || !hasTwoFactor(user)) return null;
  return session;
}

/**
 * For server-rendered admin pages, independent of the proxy: non-admins go to sign-in, and admins who
 * haven't enabled two-factor authentication are sent to set it up first.
 */
export async function assertAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/login");

  const admin = await requireAdmin();
  if (!admin) redirect(ADMIN_2FA_SETUP_PATH);
  return admin;
}
