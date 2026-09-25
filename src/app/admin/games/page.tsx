"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Game = { id: string; name: string; slug: string; description: string | null; _count: { sets: number } };

export default function AdminGamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/admin/games");
    const data = await res.json();
    setGames(data.games ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setForm({ name: "", description: "" });
    load();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold">Games</h1>

      <form onSubmit={onSubmit} className="card-surface mb-6 grid gap-3 p-5 sm:grid-cols-[1fr_2fr_auto]">
        {error && <p className="sm:col-span-3 text-sm text-red-600">{error}</p>}
        <input
          required
          placeholder="Game name (e.g. Digimon Card Game)"
          className="input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="Short description (optional)"
          className="input"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <button className="btn-primary">Add game</button>
      </form>

      {loading ? (
        <p className="text-sm text-black/50">Loading…</p>
      ) : (
        <div className="card-surface divide-y divide-black/5">
          {games.map((g) => (
            <div key={g.id} className="flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-semibold">{g.name}</p>
                <p className="text-xs text-black/50">{g.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-black/50">{g._count.sets} sets</span>
                <Link href={`/admin/sets?gameId=${g.id}`} className="text-brand-600 hover:underline">
                  Manage sets
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
