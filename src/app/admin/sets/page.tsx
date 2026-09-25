"use client";

import { useEffect, useState } from "react";

type Game = { id: string; name: string };
type CardSet = {
  id: string;
  name: string;
  code: string | null;
  isPromo: boolean;
  releaseDate: string | null;
  game: { id: string; name: string };
  _count: { cards: number };
};

export default function AdminSetsPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [sets, setSets] = useState<CardSet[]>([]);
  const [form, setForm] = useState({ gameId: "", name: "", code: "", releaseDate: "", isPromo: false });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [gamesRes, setsRes] = await Promise.all([fetch("/api/admin/games"), fetch("/api/admin/sets")]);
    const gamesData = await gamesRes.json();
    const setsData = await setsRes.json();
    setGames(gamesData.games ?? []);
    setSets(setsData.sets ?? []);
    if (!form.gameId && gamesData.games?.[0]) {
      setForm((f) => ({ ...f, gameId: gamesData.games[0].id }));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setForm({ ...form, name: "", code: "", releaseDate: "", isPromo: false });
    load();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold">Sets & promo drops</h1>
      <p className="mb-6 text-sm text-black/50">
        Promo cards are just cards that live in a set flagged "Promo" — create a set like "2026 Prerelease
        Promos" and check the box below, then add cards to it like any other set.
      </p>

      <form onSubmit={onSubmit} className="card-surface mb-6 grid gap-3 p-5 sm:grid-cols-2">
        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        <div>
          <label className="label">Game</label>
          <select className="input" value={form.gameId} onChange={(e) => setForm({ ...form, gameId: e.target.value })}>
            {games.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Set name</label>
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Set code (optional)</label>
          <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </div>
        <div>
          <label className="label">Release date (optional)</label>
          <input type="date" className="input" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isPromo} onChange={(e) => setForm({ ...form, isPromo: e.target.checked })} />
          This is a promo set
        </label>
        <button className="btn-primary sm:col-span-2">Create set</button>
      </form>

      {loading ? (
        <p className="text-sm text-black/50">Loading…</p>
      ) : (
        <div className="card-surface divide-y divide-black/5">
          {sets.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-semibold">
                  {s.name} {s.isPromo && <span className="badge bg-ember-500 text-white ml-2">Promo</span>}
                </p>
                <p className="text-xs text-black/50">{s.game.name}{s.code ? ` · ${s.code}` : ""}</p>
              </div>
              <span className="text-black/50">{s._count.cards} cards</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
