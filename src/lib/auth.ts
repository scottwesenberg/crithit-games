import { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rateLimit";
import { hasTwoFactor, verifySecondFactor } from "@/lib/twoFactor";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email & password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        code: { label: "Verification code", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required.");
        }

        // Throttle guessing: per client IP, and per account regardless of IP.
        const email = credentials.email.toLowerCase().trim();
        const ip = clientIp(req?.headers as Record<string, string | string[] | undefined> | undefined);
        const ipGate = rateLimit(`login:ip:${ip}`, 30, 15 * 60_000);
        const acctGate = rateLimit(`login:acct:${email}`, 10, 15 * 60_000);
        if (!ipGate.ok || !acctGate.ok) {
          throw new Error("Too many sign-in attempts. Please wait a few minutes and try again.");
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        // One generic message for "no such account" and "wrong password" so the form can't be used
        // to discover which emails are registered.
        const valid = user ? await bcrypt.compare(credentials.password, user.passwordHash) : false;
        if (!user || !valid) {
          throw new Error("Invalid email or password.");
        }

        if (!user.emailVerified) {
          throw new Error("Please verify your email before signing in.");
        }

        // Second factor: if the account has 2FA on, a valid code is mandatory. The login form calls
        // /api/2fa/challenge first to learn this and to have an emailed code sent when needed.
        if (hasTwoFactor(user)) {
          const code = credentials.code?.trim();
          if (!code) throw new Error("Enter your verification code.");
          const codeGate = rateLimit(`login:2fa:${user.id}`, 10, 15 * 60_000);
          if (!codeGate.ok) {
            throw new Error("Too many attempts. Please wait a few minutes and try again.");
          }
          const ok = await verifySecondFactor(user, code);
          if (!ok) throw new Error("That code is invalid or has expired.");
          resetRateLimit(`login:2fa:${user.id}`);
        }

        resetRateLimit(`login:acct:${email}`);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
