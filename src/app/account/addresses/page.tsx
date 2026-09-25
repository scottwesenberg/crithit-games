"use client";

import { useEffect, useState } from "react";

type Address = {
  id: string;
  label: string;
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string | null;
  isDefault: boolean;
};

const empty = {
  label: "Home",
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
  phone: "",
  isDefault: false,
};

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/account/addresses");
    const data = await res.json();
    setAddresses(data.addresses ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/account/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not save address");
      return;
    }
    setForm(empty);
    setShowForm(false);
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
    load();
  }

  async function makeDefault(id: string) {
    await fetch(`/api/account/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Addresses</h1>
        <button className="btn-secondary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Add address"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="card-surface mb-6 grid gap-3 p-5 sm:grid-cols-2">
          {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
          <div>
            <label className="label">Label</label>
            <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div>
            <label className="label">Full name</label>
            <input required className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address line 1</label>
            <input required className="input" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address line 2</label>
            <input className="input" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
          </div>
          <div>
            <label className="label">City</label>
            <input required className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div>
            <label className="label">State</label>
            <input required className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </div>
          <div>
            <label className="label">Postal code</label>
            <input required className="input" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
          </div>
          <div>
            <label className="label">Country</label>
            <input required maxLength={2} className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Set as default
          </label>
          <button type="submit" className="btn-primary sm:col-span-2">Save address</button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-black/50">Loading…</p>
      ) : addresses.length === 0 ? (
        <div className="card-surface p-10 text-center text-black/50">No saved addresses yet.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="card-surface p-4 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-bold">{a.label}</p>
                {a.isDefault && <span className="badge bg-brand-100 text-brand-700">Default</span>}
              </div>
              <p>{a.fullName}</p>
              <p>{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
              <p>{a.city}, {a.state} {a.postalCode}</p>
              <p>{a.country}</p>
              <div className="mt-3 flex gap-3 text-xs">
                {!a.isDefault && (
                  <button className="text-brand-600 hover:underline" onClick={() => makeDefault(a.id)}>
                    Make default
                  </button>
                )}
                <button className="text-red-600 hover:underline" onClick={() => remove(a.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
