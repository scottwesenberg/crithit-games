"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import PasswordInput from "@/components/ui/PasswordInput";

function LoginForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setLoading(false);
      setError(res.error);
      return;
    }
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
