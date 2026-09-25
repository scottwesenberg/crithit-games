"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CONDITIONS } from "@/lib/constants";

export type FilterOptions = {
  sets: { slug: string; name: string; isPromo: boolean }[];
  rarities: string[];
  cardTypes: string[];
  finishes: string[];
};

export type CurrentFilters = {
  set?: string;
  rarity?: string;
  cardType?: string;
  finish?: string;
  condition?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  promoOnly?: string;
  sort?: string;
  q?: string;
};

export default function FilterSidebar({
  options,
  current,
}: {
  options: FilterOptions;
  current: CurrentFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<CurrentFilters>(current);
  // Collapsed by default on mobile/tablet so the filter list doesn't push the results off
  // screen before you see any cards; lg: breakpoint and up always shows it (see className
  // below), so this flag only matters below that width.
  const [open, setOpen] = useState(false);

  function apply(next: CurrentFilters) {
    setState(next);
    const params = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`${pathname}?${params.toString()}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    apply(state);
    setOpen(false);
  }

  function clearAll() {
    apply({});
  }

  return (
    <form onSubmit={onSubmit} className="card-surface flex flex-col gap-4 p-4 lg:sticky lg:top-20">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900">Filters</h2>
        <div className="flex items-center gap-3">
          <button type="button" onClick={clearAll} className="text-xs text-brand-600 hover:underline">
            Clear all
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-xs font-semibold text-ink-900 lg:hidden"
          >
            {open ? "Hide" : "Show"}
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            >
              <path d="M5.25 7.5L10 12.25L14.75 7.5H5.25Z" />
            </svg>
          </button>
        </div>
      </div>

      <div className={`${open ? "flex" : "hidden"} flex-col gap-5 lg:flex`}>

      {options.sets.length > 0 && (
        <div>
          <label className="label">Set</label>
          <select
            className="input"
            value={state.set ?? ""}
            onChange={(e) => apply({ ...state, set: e.target.value || undefined })}
          >
            <option value="">All sets</option>
            {options.sets.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
                {s.isPromo ? " (Promos)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {options.rarities.length > 0 && (
        <div>
          <label className="label">Rarity</label>
          <select
            className="input"
            value={state.rarity ?? ""}
            onChange={(e) => apply({ ...state, rarity: e.target.value || undefined })}
          >
            <option value="">Any rarity</option>
            {options.rarities.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      )}

      {options.cardTypes.length > 0 && (
        <div>
          <label className="label">Card type</label>
          <select
            className="input"
            value={state.cardType ?? ""}
            onChange={(e) => apply({ ...state, cardType: e.target.value || undefined })}
          >
            <option value="">Any type</option>
            {options.cardTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}

      {options.finishes.length > 0 && (
        <div>
          <label className="label">Finish</label>
          <select
            className="input"
            value={state.finish ?? ""}
            onChange={(e) => apply({ ...state, finish: e.target.value || undefined })}
          >
            <option value="">Any finish</option>
            {options.finishes.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label">Condition</label>
        <select
          className="input"
          value={state.condition ?? ""}
          onChange={(e) => apply({ ...state, condition: e.target.value || undefined })}
        >
          <option value="">Any condition</option>
          {CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Price range ($)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder="Min"
            className="input"
            value={state.minPrice ?? ""}
            onChange={(e) => setState({ ...state, minPrice: e.target.value || undefined })}
          />
          <span className="text-black/30">–</span>
          <input
            type="number"
            min={0}
            placeholder="Max"
            className="input"
            value={state.maxPrice ?? ""}
            onChange={(e) => setState({ ...state, maxPrice: e.target.value || undefined })}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.inStock === "1"}
          onChange={(e) => apply({ ...state, inStock: e.target.checked ? "1" : undefined })}
        />
        In stock only
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.promoOnly === "1"}
          onChange={(e) => apply({ ...state, promoOnly: e.target.checked ? "1" : undefined })}
        />
        Promos only
      </label>

      <button type="submit" className="btn-primary">
        Apply filters
      </button>
      </div>
    </form>
  );
}
