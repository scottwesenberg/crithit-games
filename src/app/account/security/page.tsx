"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PasswordInput from "@/components/ui/PasswordInput";

type Status = {
  role: "USER" | "ADMIN";
  totpEnabled: boolean;
  emailOtpEnabled: boolean;
  emailAvailable: boolean;
  recoveryCodesRemaining: number;
};

type TotpSetup = { secret: string; qr: string };

async function call(body: Record<string, unknown>) {
  const res = await fetch("/api/account/2fa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data;
}

function SecurityPanel() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [totpSetup, setTotpSetup] = useState<TotpSetup | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [emailPending, setEmailPending] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState<null | "disable-totp" | "disable-email" | "regenerate">(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/account/2fa");
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function run(fn: () => Promise<void>) {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const startTotp = () =>
    run(async () => {
      const data = await call({ action: "totp-setup" });
      setTotpSetup({ secret: data.secret, qr: data.qr });
      setTotpCode("");
    });

  const confirmTotp = () =>
    run(async () => {
      const data = await call({ action: "totp-enable", code: totpCode });
      setTotpSetup(null);
      setTotpCode("");
      if (data.recoveryCodes) setRecoveryCodes(data.recoveryCodes);
      setMessage("Authenticator app is on.");
    });

  const startEmail = () =>
    run(async () => {
      await call({ action: "email-send" });
      setEmailPending(true);
      setEmailCode("");
      setMessage("We emailed you a 6-digit code.");
    });

  const confirmEmail = () =>
    run(async () => {
      const data = await call({ action: "email-enable", code: emailCode });
      setEmailPending(false);
      setEmailCode("");
      if (data.recoveryCodes) setRecoveryCodes(data.recoveryCodes);
      setMessage("Email codes are on.");
    });

  const confirmPasswordAction = () =>
    run(async () => {
      if (confirming === "regenerate") {
        const data = await call({ action: "recovery-regenerate", password });
        setRecoveryCodes(data.recoveryCodes);
        setMessage("New recovery codes generated. The old ones no longer work.");
      } else if (confirming) {
        await call({ action: "disable", method: confirming === "disable-totp" ? "totp" : "email", password });
        setMessage("Turned off.");
      }
      setConfirming(null);
      setPassword("");
    });

  if (!status) return <p className="text-sm text-black/50">Loading…</p>;

  const anyOn = status.totpEnabled || status.emailOtpEnabled;
  const adminNeedsSetup = status.role === "ADMIN" && !anyOn;

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Security</h1>
        <p className="mt-1 text-sm text-black/60">
          Two-step verification asks for a second code when you sign in, so a stolen password isn&apos;t enough to get into your account.
        </p>
      </div>

      {adminNeedsSetup && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Admin accounts must have two-step verification turned on before the admin area can be used. Set up at least
          one method below.
        </p>
      )}
      {status.role === "ADMIN" && anyOn && searchParams.get("required") && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          You&apos;re all set. <Link href="/admin" className="font-semibold underline">Go to the admin dashboard</Link>.
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}

      {recoveryCodes && (
        <div className="card-surface space-y-3 border-2 border-amber-300 p-5">
          <h2 className="font-bold">Save your recovery codes</h2>
          <p className="text-sm text-black/60">
            Each code works once if you lose access to your authenticator app or email. They won&apos;t be shown again —
            store them somewhere safe, like a password manager.
          </p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
            {recoveryCodes.map((c) => (
              <li key={c} className="rounded bg-black/5 px-2 py-1">{c}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigator.clipboard?.writeText(recoveryCodes.join("\n"))}
            >
              Copy
            </button>
            <button type="button" className="btn-primary" onClick={() => setRecoveryCodes(null)}>
              I&apos;ve saved them
            </button>
          </div>
        </div>
      )}

      {/* Authenticator app */}
      <section className="card-surface space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Authenticator app</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.totpEnabled ? "bg-green-100 text-green-700" : "bg-black/5 text-black/50"}`}>
            {status.totpEnabled ? "On" : "Off"}
          </span>
        </div>
        <p className="text-sm text-black/60">
          Use an app like Google Authenticator, Microsoft Authenticator, 1Password, or Authy to generate sign-in codes.
        </p>
        {!status.totpEnabled && !totpSetup && (
          <button type="button" disabled={busy} onClick={startTotp} className="btn-primary">Set up authenticator app</button>
        )}
        {totpSetup && (
          <div className="space-y-3">
            <p className="text-sm">1. Scan this QR code with your app, or type the key in manually.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={totpSetup.qr} alt="QR code for your authenticator app" width={220} height={220} className="rounded-lg border border-black/10" />
            <p className="break-all rounded bg-black/5 px-2 py-1 font-mono text-xs">{totpSetup.secret}</p>
            <p className="text-sm">2. Enter the 6-digit code your app shows.</p>
            <div className="flex gap-2">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                className="input w-40 tracking-widest"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
              />
              <button type="button" disabled={busy || totpCode.replace(/\s/g, "").length < 6} onClick={confirmTotp} className="btn-primary">Turn on</button>
              <button type="button" onClick={() => setTotpSetup(null)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        )}
        {status.totpEnabled && confirming !== "disable-totp" && (
          <button type="button" onClick={() => { setConfirming("disable-totp"); setPassword(""); }} className="btn-secondary">Turn off</button>
        )}
      </section>

      {/* Email codes */}
      <section className="card-surface space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Email codes</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.emailOtpEnabled ? "bg-green-100 text-green-700" : "bg-black/5 text-black/50"}`}>
            {status.emailOtpEnabled ? "On" : "Off"}
          </span>
        </div>
        <p className="text-sm text-black/60">We email you a 6-digit code each time you sign in.</p>
        {!status.emailAvailable && !status.emailOtpEnabled && (
          <p className="text-sm text-black/50">Email isn&apos;t configured on this deployment, so email codes are unavailable.</p>
        )}
        {status.emailAvailable && !status.emailOtpEnabled && !emailPending && (
          <button type="button" disabled={busy} onClick={startEmail} className="btn-primary">Turn on email codes</button>
        )}
        {emailPending && (
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="6-digit code"
              className="input w-40 tracking-widest"
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value)}
            />
            <button type="button" disabled={busy || emailCode.replace(/\s/g, "").length < 6} onClick={confirmEmail} className="btn-primary">Confirm</button>
            <button type="button" onClick={() => setEmailPending(false)} className="btn-ghost">Cancel</button>
          </div>
        )}
        {status.emailOtpEnabled && confirming !== "disable-email" && (
          <button type="button" onClick={() => { setConfirming("disable-email"); setPassword(""); }} className="btn-secondary">Turn off</button>
        )}
      </section>

      {/* Recovery codes */}
      {anyOn && (
        <section className="card-surface space-y-3 p-5">
          <h2 className="font-bold">Recovery codes</h2>
          <p className="text-sm text-black/60">
            {status.recoveryCodesRemaining} unused {status.recoveryCodesRemaining === 1 ? "code" : "codes"} left. Use one at sign-in if you can&apos;t get a normal code.
          </p>
          {confirming !== "regenerate" && (
            <button type="button" onClick={() => { setConfirming("regenerate"); setPassword(""); }} className="btn-secondary">Generate new codes</button>
          )}
        </section>
      )}

      {/* Password confirmation for sensitive changes */}
      {confirming && (
        <section className="card-surface space-y-3 p-5">
          <h2 className="font-bold">
            {confirming === "regenerate" ? "Generate new recovery codes" : "Turn off two-step verification method"}
          </h2>
          <p className="text-sm text-black/60">Confirm your password to continue.</p>
          <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" disabled={busy || !password} onClick={confirmPasswordAction} className="btn-primary">Confirm</button>
            <button type="button" onClick={() => { setConfirming(null); setPassword(""); }} className="btn-ghost">Cancel</button>
          </div>
        </section>
      )}
    </div>
  );
}

export default function SecurityPage() {
  return (
    <Suspense fallback={null}>
      <SecurityPanel />
    </Suspense>
  );
}
