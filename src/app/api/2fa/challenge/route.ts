import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { hasTwoFactor, sendEmailCode } from "@/lib/twoFactor";
import { isEmailConfigured } from "@/lib/mailer";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
  sendEmail: z.boolean().optional(),
});

/**
 * Step 1 of sign-in. Checks the password and tells the login form whether a second factor is needed
 * (and which kinds). Emails a code when the account uses email codes. It never signs anyone in —
 * NextAuth's authorize() re-checks everything, including the code, in step 2.
 */
export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const ipGate = rateLimit(`challenge:ip:${ip}`, 30, 15 * 60_000);
  if (!ipGate.ok) return tooManyRequests(ipGate.retryAfterSeconds, "Too many sign-in attempts. Please wait a few minutes.");

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });

  const email = parsed.data.email.toLowerCase().trim();
  const acctGate = rateLimit(`challenge:acct:${email}`, 10, 15 * 60_000);
  if (!acctGate.ok) return tooManyRequests(acctGate.retryAfterSeconds, "Too many sign-in attempts. Please wait a few minutes.");

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
  if (!user || !valid) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  if (!user.emailVerified) {
    return NextResponse.json({ error: "Please verify your email before signing in." }, { status: 403 });
  }

  if (!hasTwoFactor(user)) return NextResponse.json({ twoFactor: false });

  // Email codes go out automatically when they're the only method; with an authenticator app as well,
  // only when the user asks ("Email me a code instead").
  let emailSent = false;
  const emailAvailable = user.emailOtpEnabled && isEmailConfigured();
  if (emailAvailable && (parsed.data.sendEmail || !user.totpEnabled)) {
    const sendGate = rateLimit(`challenge:send:${user.id}`, 5, 15 * 60_000);
    if (!sendGate.ok) return tooManyRequests(sendGate.retryAfterSeconds, "Too many codes requested. Please wait a few minutes.");
    try {
      await sendEmailCode(user);
      emailSent = true;
    } catch (err) {
      console.error("[2fa] failed to send email code", err);
      if (!user.totpEnabled) {
        return NextResponse.json(
          { error: "We couldn't send your code right now. Use a recovery code or try again shortly." },
          { status: 503 }
        );
      }
    }
  }

  return NextResponse.json({
    twoFactor: true,
    totp: user.totpEnabled,
    email: user.emailOtpEnabled,
    emailSent,
  });
}
