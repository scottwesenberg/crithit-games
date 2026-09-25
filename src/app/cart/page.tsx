"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useCart } from "@/components/cart/CartProvider";
import { formatCents } from "@/lib/utils";
import { conditionShort } from "@/lib/constants";

export default function CartPage() {
  const { items, updateQuantity, removeItem, subtotalCents } = useCart();
  const { status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout");
      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-page py-10">
      <h1 className="mb-6 text-2xl font-extrabold">Your cart</h1>

      {items.length === 0 ? (
        <div className="card-surface p-10 text-center">
          <p className="mb-4 text-black/60">Your cart is empty.</p>
          <Link href="/games" className="btn-primary">Browse games</Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="card-surface divide-y divide-black/5">
            {items.map((item) => (
              <div key={item.variantId} className="flex items-center gap-4 p-4">
                <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-md bg-black/5">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.cardName} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{item.cardName}</p>
                  <p className="text-xs text-black/50">
                    {item.setName} · {item.finish} · {conditionShort(item.condition)}
                  </p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={item.maxQuantity}
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.variantId, Number(e.target.value))}
                  className="input w-16"
                />
                <p className="w-20 text-right font-semibold">{formatCents(item.priceCents * item.quantity)}</p>
                <button className="text-xs text-black/40 hover:text-red-600" onClick={() => removeItem(item.variantId)}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="card-surface h-fit p-5">
            <div className="mb-4 flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-semibold">{formatCents(subtotalCents)}</span>
            </div>
            <p className="mb-4 text-xs text-black/50">
              Shipping and tax are calculated at checkout.
            </p>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <button onClick={checkout} disabled={loading} className="btn-primary w-full">
              {loading ? "Redirecting…" : "Checkout with Stripe"}
            </button>
            {status !== "authenticated" && (
              <p className="mt-3 text-center text-xs text-black/50">
                <Link href="/login?callbackUrl=/cart" className="text-brand-600 hover:underline">Sign in</Link> to
                track this order, or check out as a guest.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
