import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { isEmailConfigured } from "@/lib/mailer";
import {
  decryptSecret,
  encryptSecret,
  generateTotpSecret,
  hasTwoFactor,
  matchTotpStep,
  regenerateRecoveryCodes,
  remainingRecoveryCodes,
  sendEmailCode,
  totpUri,
  verifyEmailCode,
} from "@/lib/twoFactor";

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("totp-setup") }),
  z.object({ action: z.literal("totp-enable"), code: z.string().min(6).max(10) }),
  z.object({ action: z.literal("email-send") }),
  z.object({ action: z.literal("email-enable"), code: z.string().min(6).max(10) }),
  z.object({ action: z.literal("disable"), method: z.enum(["totp", "email"]), password: z.string().min(1).max(200) }),
  z.object({ action: z.literal("recovery-regenerate"), password: z.string().min(1).max(200) }),
]);

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Current 2FA status for the signed-in user. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return fail("Unauthorized", 401);
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return fail("Not found", 404);

  return NextResponse.json({
    role: user.role,
    totpEnabled: user.totpEnabled,
    emailOtpEnabled: user.emailOtpEnabled,
    emailAvailable: isEmailConfigured(),
    recoveryCodesRemaining: await remainingRecoveryCodes(user.id),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return fail("Unauthorized", 401);

  const parsed = action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid request.");
  const body = parsed.data;

  const gate = rateLimit(`2fa-manage:${session.user.id}`, 20, 15 * 60_000);
  if (!gate.ok) return tooManyRequests(gate.retryAfterSeconds);

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return fail("Not found", 404);

  /** Recovery codes are created the first time any method is turned on. */
  async function firstTimeRecoveryCodes() {
    const existing = await prisma.recoveryCode.count({ where: { userId: user!.id } });
    return existing === 0 ? regenerateRecoveryCodes(user!.id) : null;
  }

  switch (body.action) {
    case "totp-setup": {
      if (user.totpEnabled) return fail("Authenticator app is already enabled.");
      const secret = generateTotpSecret();
      await prisma.user.update({
        where: { id: user.id },
        data: { totpSecretEnc: encryptSecret(secret), totpLastStep: null },
      });
      const uri = totpUri(user.email, secret);
      const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
      return NextResponse.json({ secret, uri, qr });
    }

    case "totp-enable": {
      if (user.totpEnabled || !user.totpSecretEnc) return fail("Start the authenticator setup first.");
      let secret: string;
      try {
        secret = decryptSecret(user.totpSecretEnc);
      } catch {
        return fail("Setup expired. Please start the authenticator setup again.");
      }
      const step = matchTotpStep(secret, body.code.replace(/\s/g, ""));
      if (step === null) return fail("That code didn't match. Check your app and try again.");
      await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true, totpLastStep: step } });
      return NextResponse.json({ ok: true, recoveryCodes: await firstTimeRecoveryCodes() });
    }

    case "email-send": {
      if (!isEmailConfigured()) return fail("Email isn't set up on this site, so email codes aren't available.");
      if (user.emailOtpEnabled) return fail("Email codes are already enabled.");
      const sendGate = rateLimit(`2fa-email-send:${user.id}`, 5, 15 * 60_000);
      if (!sendGate.ok) return tooManyRequests(sendGate.retryAfterSeconds, "Too many codes requested. Please wait a few minutes.");
      try {
        await sendEmailCode(user);
      } catch (err) {
        console.error("[2fa] failed to send email code", err);
        return fail("We couldn't send the email. Please try again shortly.", 503);
      }
      return NextResponse.json({ ok: true });
    }

    case "email-enable": {
      if (user.emailOtpEnabled) return fail("Email codes are already enabled.");
      const ok = await verifyEmailCode(user.id, body.code.replace(/\s/g, ""));
      if (!ok) return fail("That code is invalid or has expired.");
      await prisma.user.update({ where: { id: user.id }, data: { emailOtpEnabled: true } });
      return NextResponse.json({ ok: true, recoveryCodes: await firstTimeRecoveryCodes() });
    }

    case "disable": {
      const valid = await bcrypt.compare(body.password, user.passwordHash);
      if (!valid) return fail("Password is incorrect.");
      const data =
        body.method === "totp"
          ? { totpEnabled: false, totpSecretEnc: null, totpLastStep: null }
          : { emailOtpEnabled: false };
      const after = await prisma.user.update({ where: { id: user.id }, data });
      if (!hasTwoFactor(after)) {
        await prisma.recoveryCode.deleteMany({ where: { userId: user.id } });
        await prisma.loginCode.deleteMany({ where: { userId: user.id } });
      }
      return NextResponse.json({ ok: true });
    }

    case "recovery-regenerate": {
      if (!hasTwoFactor(user)) return fail("Turn on two-factor authentication first.");
      const valid = await bcrypt.compare(body.password, user.passwordHash);
      if (!valid) return fail("Password is incorrect.");
      return NextResponse.json({ ok: true, recoveryCodes: await regenerateRecoveryCodes(user.id) });
    }
  }
}
