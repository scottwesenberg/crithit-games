import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { createToken, tokenExpiry } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mailer";

export async function POST(req: Request) {
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

  const user = await prisma.user.create({
    data: { name: parsed.data.name, email, passwordHash },
  });

  const token = createToken();
  await prisma.emailVerificationToken.create({
    data: { token, userId: user.id, expires: tokenExpiry(24) },
  });

  const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await sendVerificationEmail(user.email, user.name, `${appUrl}/api/auth/verify?token=${token}`);

  return NextResponse.json({ ok: true });
}
