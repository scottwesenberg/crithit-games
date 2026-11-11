import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { createToken, tokenExpiry } from "@/lib/tokens";
import { isEmailConfigured, sendVerificationEmail } from "@/lib/mailer";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const gate = rateLimit(`register:${clientIp(req.headers)}`, 5, 60 * 60_000);
  if (!gate.ok) return tooManyRequests(gate.retryAfterSeconds, "Too many sign-ups from this network. Please try again later.");

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  // Demo mode: with no SMTP configured there is no way to deliver a verification link, so accounts
  // are verified immediately. With SMTP configured, the normal email-verification flow applies.
  const emailEnabled = isEmailConfigured();

  const user = await prisma.user.create({
    data: { name: parsed.data.name, email, passwordHash, emailVerified: emailEnabled ? null : new Date() },
  });

  if (!emailEnabled) {
    return NextResponse.json({ ok: true, autoVerified: true });
  }

  const token = createToken();
  await prisma.emailVerificationToken.create({
    data: { token, userId: user.id, expires: tokenExpiry(24) },
  });

  const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  try {
    await sendVerificationEmail(user.email, user.name, `${appUrl}/api/auth/verify?token=${token}`);
  } catch (err) {
    // Misconfigured SMTP: don't leave an unverifiable account behind (it would block re-registering).
    console.error("[register] could not send verification email:", err);
    await prisma.user.delete({ where: { id: user.id } });
    return NextResponse.json(
      { error: "We couldn't send the verification email right now. Please try again later." },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true });
}
