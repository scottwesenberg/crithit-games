import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createToken, tokenExpiry } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const gate = rateLimit(`forgot:${clientIp(req.headers)}`, 5, 60 * 60_000);
  if (!gate.ok) return tooManyRequests(gate.retryAfterSeconds);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });

  // Always respond with ok — don't reveal whether an account exists.
  if (user) {
    const token = createToken();
    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expires: tokenExpiry(1) },
    });
    const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    await sendPasswordResetEmail(user.email, `${appUrl}/reset-password?token=${token}`);
  }

  return NextResponse.json({ ok: true });
}
