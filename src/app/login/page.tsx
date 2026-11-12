"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import PasswordInput from "@/components/ui/PasswordInput";

type Challenge = { totp: boolean; email: boolean; emailSent: boolean };

function LoginForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** Step 1 (and "send me an email code"): verifies the password and asks what else is needed. */
  async function runChallenge(sendEmail: boolean) {
    const res = await fetch("/api/2fa/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, sendEmail }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Could not sign in. Please try again.");
    return data as { twoFactor: boolean } & Partial<Challenge>;
  }

  async function finishSignIn(withCode?: string) {
    const res = await signIn("credentials", { email, password, code: withCode ?? "", redirect: false });
    if (res?.error) throw new Error(res.error);
    // Full page navigation so the app reloads with the new session cookie. (A client-side router.push can
    // land on a cached signed-out redirect, which is why the first click used to seem to do nothing.)
    // Only same-site destinations are honored.
    let destination = "/account";
    try {
      const target = new URL(searchParams.get("callbackUrl") ?? "/account", window.location.origin);
      if (target.origin === window.location.origin) destination = target.pathname + target.search;
    } catch {
      // fall back to /account
    }
    window.location.assign(destination);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (!challenge) {
        const data = await runChallenge(false);
        if (data.twoFactor) {
          setChallenge({ totp: !!data.totp, email: !!data.email, emailSent: !!data.emailSent });
          if (data.emailSent) setNotice("We emailed you a 6-digit code.");
          setLoading(false);
          return;
        }
        await finishSignIn();
      } else {
        await finishSignIn(code);
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message);
    }
  }

  async function sendEmailCode() {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const data = await runChallenge(true);
      setChallenge((c) => (c ? { ...c, emailSent: !!data.emailSent } : c));
      setNotice(data.emailSent ? "We emailed you a new 6-digit code." : "We couldn't send an email right now.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function backToPassword() {
    setChallenge(null);
    setCode("");
    setError(null);
    setNotice(null);
    setPassword("");
  }

  if (challenge) {
    const prompt = challenge.totp
      ? "Enter the 6-digit code from your authenticator app"
      : "Enter the 6-digit code we emailed you";
    return (
      <form onSubmit={onSubmit} className="card-surface w-full max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-extrabold">Two-step verification</h1>
        <p className="text-sm text-black/60">
          {prompt}
          {challenge.totp && challenge.email ? ", or the code we email you" : ""}. You can also use a recovery code.
        </p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>}
        <div>
          <label className="label">Verification code</label>
          <input
            required
            autoFocus
            inputMode="text"
            autoComplete="one-time-code"
            className="input tracking-widest"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Verifying…" : "Verify and sign in"}
        </button>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-black/50">
          <button type="button" onClick={backToPassword} className="hover:underline">
            ← Back
          </button>
          {challenge.email && (
            <button type="button" onClick={sendEmailCode} disabled={loading} className="hover:underline">
              {challenge.emailSent ? "Resend email code" : "Email me a code instead"}
            </button>
          )}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card-surface w-full max-w-sm space-y-4 p-6">
      <h1 className="text-xl font-extrabold">Sign in</h1>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div>
        <label className="label">Email</label>
        <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label">Password</label>
        <PasswordInput
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <div className="flex justify-between text-xs text-black/50">
        <Link href="/forgot-password" className="hover:underline">Forgot password?</Link>
        <Link href="/register" className="hover:underline">Create an account</Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="container-page flex justify-center py-16">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
