// Two-factor authentication helpers: TOTP (authenticator apps), emailed codes, and one-time recovery codes.
// Uses only Node's built-in crypto, so there are no extra dependencies to audit.

import crypto from "crypto";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTwoFactorCodeEmail } from "@/lib/mailer";

const ISSUER = "CritHit Games";
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const EMAIL_CODE_TTL_MS = 10 * 60_000;
const EMAIL_CODE_MAX_ATTEMPTS = 5;
const RECOVERY_CODE_COUNT = 8;

// ---------- secrets at rest ----------

/** 32-byte key for encrypting TOTP secrets. Prefers TOTP_ENCRYPTION_KEY, falls back to NEXTAUTH_SECRET. */
function encryptionKey(): Buffer {
  const material = process.env.TOTP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!material) throw new Error("Set NEXTAUTH_SECRET (or TOTP_ENCRYPTION_KEY) to use two-factor authentication.");
  return crypto.createHash("sha256").update(`crithit-2fa-secret:${material}`).digest();
}

/** HMAC key for hashing recovery and emailed codes. */
function hashKey(): Buffer {
  const material = process.env.TOTP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "";
  return crypto.createHash("sha256").update(`crithit-2fa-hash:${material}`).digest();
}

function hashCode(value: string): string {
  return crypto.createHmac("sha256", hashKey()).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// ---------- TOTP (RFC 6238) ----------

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of str.replace(/=+$/, "").toUpperCase()) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function totpUri(email: string, secret: string): string {
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin =
    ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

/** Returns the matching time-step (allowing ±1 step of clock drift) or null. */
export function matchTotpStep(secret: string, code: string): number | null {
  const now = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);
  for (const step of [now, now - 1, now + 1]) {
    if (safeEqual(totpAt(secret, step), code)) return step;
  }
  return null;
}

// ---------- recovery codes ----------

function normalizeRecovery(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Replaces any existing recovery codes with a fresh set and returns the plain codes (shown once). */
export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no easily-confused characters
  const codes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    let c = "";
    for (const b of crypto.randomBytes(10)) c += alphabet[b % alphabet.length];
    codes.push(`${c.slice(0, 5)}-${c.slice(5)}`);
  }
  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.recoveryCode.createMany({
      data: codes.map((c) => ({ userId, codeHash: hashCode(`recovery:${normalizeRecovery(c)}`) })),
    }),
  ]);
  return codes;
}

async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const hash = hashCode(`recovery:${normalizeRecovery(code)}`);
  const res = await prisma.recoveryCode.updateMany({
    where: { userId, codeHash: hash, usedAt: null },
    data: { usedAt: new Date() },
  });
  return res.count > 0;
}

export async function remainingRecoveryCodes(userId: string): Promise<number> {
  return prisma.recoveryCode.count({ where: { userId, usedAt: null } });
}

// ---------- emailed codes ----------

/** Creates a fresh 6-digit code (invalidating older ones) and emails it. */
export async function sendEmailCode(user: Pick<User, "id" | "email">): Promise<void> {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.loginCode.deleteMany({ where: { userId: user.id } });
  await prisma.loginCode.create({
    data: {
      userId: user.id,
      codeHash: hashCode(`email:${user.id}:${code}`),
      expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
    },
  });
  await sendTwoFactorCodeEmail(user.email, code);
}

export async function verifyEmailCode(userId: string, code: string): Promise<boolean> {
  const record = await prisma.loginCode.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.attempts >= EMAIL_CODE_MAX_ATTEMPTS) return false;

  // Count the attempt first so parallel guesses can't exceed the cap.
  const bumped = await prisma.loginCode.updateMany({
    where: { id: record.id, attempts: { lt: EMAIL_CODE_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (bumped.count === 0) return false;

  if (!safeEqual(record.codeHash, hashCode(`email:${userId}:${code}`))) return false;
  const used = await prisma.loginCode.deleteMany({ where: { id: record.id } });
  return used.count > 0;
}

// ---------- verifying a code at sign-in ----------

export function hasTwoFactor(user: Pick<User, "totpEnabled" | "emailOtpEnabled">): boolean {
  return user.totpEnabled || user.emailOtpEnabled;
}

/** Verifies the TOTP code against a stored secret, rejecting reuse of the same time-step. */
export async function verifyTotpForUser(
  user: Pick<User, "id" | "totpSecretEnc" | "totpLastStep">,
  code: string
): Promise<boolean> {
  if (!user.totpSecretEnc) return false;
  const step = matchTotpStep(decryptSecret(user.totpSecretEnc), code);
  if (step === null) return false;
  const claimed = await prisma.user.updateMany({
    where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
    data: { totpLastStep: step },
  });
  return claimed.count > 0;
}

/** Accepts an authenticator code, an emailed code (both 6 digits), or a recovery code. */
export async function verifySecondFactor(user: User, rawCode: string): Promise<boolean> {
  const code = rawCode.replace(/[\s-]/g, "");
  if (!code) return false;

  if (/^\d{6}$/.test(code)) {
    if (user.totpEnabled && (await verifyTotpForUser(user, code))) return true;
    if (user.emailOtpEnabled && (await verifyEmailCode(user.id, code))) return true;
    return false;
  }
  return consumeRecoveryCode(user.id, rawCode);
}
