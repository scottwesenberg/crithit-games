// Next.js 16 renamed the "middleware" file convention to "proxy". Same behavior: runs before matched
// routes and sends signed-out visitors to /login and non-admins away from /admin. (Admin pages and API
// routes also check the session on the server, so this is a first gate, not the only one.)
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function proxy(req) {
    const token = req.nextauth.token;
    const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");

    if (isAdminRoute && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
