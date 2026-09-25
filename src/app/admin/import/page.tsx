"use client";

import { useState } from "react";
import Link from "next/link";

type ImportResult = {
  batch: { id: string; status: string; totalRows: number; successRows: number; errorRows: number };
  errors: { row: number; message: string }[];
};

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-extrabold">CSV import</h1>
      <p className="mb-6 text-sm text-black/50">
        Bulk add or update cards and their price/stock variants. Games, sets, and cards that don't exist yet are
        created automatically; rows for a card you already have update its price and quantity instead of
        duplicating it.
      </p>

      <div className="card-surface mb-6 p-5">
        <h2 className="mb-2 font-bold">Expected columns</h2>
        <p className="mb-3 text-sm text-black/60">
          <code className="rounded bg-black/5 px-1 py-0.5">game, set, promo, name, collector_number, rarity,
          card_type, sub_type, description, image_url, finish, condition, language, price, quantity, sku</code>
        </p>
        <ul className="mb-3 list-disc pl-5 text-sm text-black/60">
          <li><strong>promo</strong>: TRUE/FALSE — marks the set (and its cards) as a promo release.</li>
          <li><strong>condition</strong>: NM, LP, MP, HP, or DMG.</li>
          <li>One row per finish/condition combo — repeat the card's other columns to add e.g. a foil row.</li>
          <li><strong>sku</strong> is optional; one is generated automatically if left blank.</li>
        </ul>
        <a href="/templates/card-import-template.csv" download className="text-sm font-medium text-brand-600 hover:underline">
          Download a starter template →
        </a>
      </div>

      <form onSubmit={onSubmit} className="card-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label">CSV file</label>
          <input
            type="file"
            accept=".csv,text/csv"
            className="input"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <button type="submit" disabled={!file || loading} className="btn-primary">
          {loading ? "Importing…" : "Import"}
        </button>
      </form>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="mt-6 card-surface p-5">
          <h2 className="mb-2 font-bold">Import result</h2>
          <div className="mb-4 flex gap-6 text-sm">
            <span>Total rows: <strong>{result.batch.totalRows}</strong></span>
            <span className="text-green-700">Succeeded: <strong>{result.batch.successRows}</strong></span>
            <span className="text-red-700">Errors: <strong>{result.batch.errorRows}</strong></span>
          </div>
          {result.errors.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-black/10">
              <table className="w-full text-sm">
                <thead className="bg-black/5 text-left text-xs uppercase text-black/50">
                  <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Error</th></tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {result.errors.map((e, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{e.row}</td>
                      <td className="px-3 py-2 text-red-700">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Link href="/admin/cards" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
            View cards →
          </Link>
        </div>
      )}
    </div>
  );
}
