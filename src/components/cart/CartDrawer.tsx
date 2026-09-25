"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { formatCents } from "@/lib/utils";
import { conditionShort } from "@/lib/constants";

export default function CartDrawer() {
  const { items, isOpen, close, updateQuantity, removeItem, subtotalCents } = useCart();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close cart"
        className="absolute inset-0 bg-black/40"
        onClick={close}
      />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
          <h2 className="text-lg font-semibold">Your cart</h2>
          <button className="btn-ghost" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="text-sm text-black/60">Your cart is empty.</p>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-3">
                  <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded-md bg-black/5">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.cardName} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-tight">{item.cardName}</p>
                    <p className="text-xs text-black/50">
                      {item.setName} · {item.finish} · {conditionShort(item.condition)}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={item.maxQuantity}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.variantId, Number(e.target.value))}
                        className="input w-16 py-1"
                      />
                      <button
                        className="text-xs text-brand-600 hover:underline"
                        onClick={() => removeItem(item.variantId)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-semibold">
                    {formatCents(item.priceCents * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-black/10 px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-sm font-semibold">
            <span>Subtotal</span>
            <span>{formatCents(subtotalCents)}</span>
          </div>
          <Link
            href="/cart"
            onClick={close}
            className="btn-primary w-full"
            aria-disabled={items.length === 0}
          >
            View cart & checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
