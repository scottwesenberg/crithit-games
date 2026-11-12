"use client";

import { useState } from "react";
import Link from "next/link";
import PasswordInput from "@/components/ui/PasswordInput";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [autoVerified, setAutoVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setAutoVerified(Boolean(data.autoVerified));
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="container-page flex flex-col items-center gap-4 py-24 text-center">
        <h1 className="text-2xl font-extrabold">{autoVerified ? "Account created" : "Check your inbox"}</h1>
        <p className="max-w-sm text-black/60">
          {autoVerified
            ? "This is a demo store, so email verification is turned off. You can sign in right away."
            : `We sent a verification link to ${form.email}. Click it to activate your account before signing in.`}
        </p>
        <Link href="/login" className="btn-primary">Go to sign in</Link>
      </div>
    );
  }

  return (
    <div className="container-page flex justify-center py-16">
      <form onSubmit={onSubmit} className="card-surface w-full max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-extrabold">Create your account</h1>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div>
          <label className="label">Full name</label>
          <input
            required
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            required
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Password</label>
          <PasswordInput
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <p className="mt-1 text-xs text-black/40">At least 8 characters.</p>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Creating account…" : "Create account"}
        </button>
        <p className="text-center text-xs text-black/50">
          Already have an account? <Link href="/login" className="hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
