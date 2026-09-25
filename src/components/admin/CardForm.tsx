"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CONDITIONS } from "@/lib/constants";

type GameWithSets = { id: string; name: string; sets: { id: string; name: string; isPromo: boolean }[] };

export type VariantForm = {
  id?: string;
  finish: string;
  condition: string;
  language: string;
  price: string; // dollars, as typed
  quantity: string;
};

export type CardFormInitial = {
  id: string;
  setId: string;
  setLabel: string;
  name: string;
  collectorNumber: string;
  rarity: string;
  cardType: string;
  subType: string;
  description: string;
  imageUrl: string;
  variants: VariantForm[];
};

function emptyVariant(): VariantForm {
  return { finish: "Normal", condition: "NEAR_MINT", language: "English", price: "", quantity: "0" };
}

export default function CardForm({
  games,
  initial,
}: {
  games: GameWithSets[];
  initial?: CardFormInitial;
}) {
  const router = useRouter();
  const isEdit = !!initial;

  const [setId, setSetId] = useState(initial?.setId ?? games[0]?.sets[0]?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [collectorNumber, setCollectorNumber] = useState(initial?.collectorNumber ?? "");
  const [rarity, setRarity] = useState(initial?.rarity ?? "");
  const [cardType, setCardType] = useState(initial?.cardType ?? "");
  const [subType, setSubType] = useState(initial?.subType ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [variants, setVariants] = useState<VariantForm[]>(initial?.variants ?? [emptyVariant()]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateVariant(idx: number, patch: Partial<VariantForm>) {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      setId,
      name,
      collectorNumber,
      rarity,
      cardType,
      subType,
      description,
      imageUrl,
      variants: variants.map((v) => ({
        id: v.id,
        finish: v.finish,
        condition: v.condition,
        language: v.language,
        priceCents: Math.round(Number(v.price) * 100),
        quantity: Number(v.quantity),
      })),
    };

    try {
      const res = await fetch(isEdit ? `/api/admin/cards/${initial!.id}` : "/api/admin/cards", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save card");
      router.push("/admin/cards");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="card-surface grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Set</label>
          {isEdit ? (
            <input disabled className="input opacity-60" value={initial!.setLabel} />
          ) : (
            <select className="input" value={setId} onChange={(e) => setSetId(e.target.value)}>
              {games.map((g) => (
                <optgroup key={g.id} label={g.name}>
                  {g.sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.isPromo ? " (Promo)" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="label">Card name</label>
          <input required className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="label">Collector number</label>
          <input className="input" value={collectorNumber} onChange={(e) => setCollectorNumber(e.target.value)} />
        </div>
        <div>
          <label className="label">Rarity</label>
          <input className="input" placeholder="Rare, Mythic, Secret Rare…" value={rarity} onChange={(e) => setRarity(e.target.value)} />
        </div>
        <div>
          <label className="label">Card type</label>
          <input className="input" placeholder="Creature, Pokemon, Spell…" value={cardType} onChange={(e) => setCardType(e.target.value)} />
        </div>
        <div>
          <label className="label">Sub-type</label>
          <input className="input" value={subType} onChange={(e) => setSubType(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Image URL</label>
          <div className="flex items-start gap-3">
            <input
              className="input flex-1"
              placeholder="https://…"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/10 bg-black/5">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="Card preview"
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = "flex";
                  }}
                  onLoad={(e) => {
                    (e.target as HTMLImageElement).style.display = "block";
                    const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = "none";
                  }}
                />
              ) : null}
              <span
                className="hidden h-full w-full items-center justify-center px-1 text-center text-[10px] leading-tight text-black/40"
                style={{ display: imageUrl ? "none" : "flex" }}
              >
                No image
              </span>
            </div>
          </div>
          <p className="mt-1 text-xs text-black/40">
            Paste a direct image link (ending in .jpg/.png/.webp, etc.). The preview updates as you type; if it
            stays blank the URL probably isn’t a direct image link or the host blocks hotlinking.
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description / card text</label>
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <div className="card-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Purchasable variants</h2>
          <button type="button" className="btn-secondary" onClick={() => setVariants([...variants, emptyVariant()])}>
            + Add variant
          </button>
        </div>
        <div className="space-y-3">
          {variants.map((v, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-2 rounded-lg border border-black/10 p-3 sm:grid-cols-6">
              <div>
                <label className="label">Finish</label>
                <input className="input" value={v.finish} onChange={(e) => updateVariant(idx, { finish: e.target.value })} />
              </div>
              <div>
                <label className="label">Condition</label>
                <select className="input" value={v.condition} onChange={(e) => updateVariant(idx, { condition: e.target.value })}>
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Language</label>
                <input className="input" value={v.language} onChange={(e) => updateVariant(idx, { language: e.target.value })} />
              </div>
              <div>
                <label className="label">Price ($)</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  value={v.price}
                  onChange={(e) => updateVariant(idx, { price: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Quantity</label>
                <input
                  required
                  type="number"
                  min="0"
                  className="input"
                  value={v.quantity}
                  onChange={(e) => updateVariant(idx, { quantity: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                {variants.length > 1 && (
                  <button
                    type="button"
                    className="btn-ghost text-red-600"
                    onClick={() => setVariants(variants.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving…" : isEdit ? "Save changes" : "Create card"}
      </button>
    </form>
  );
}
