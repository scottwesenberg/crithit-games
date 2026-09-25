"use client";

import { useState } from "react";
import { useCart, type CartItem } from "@/components/cart/CartProvider";

export default function AddToCartButton({
  item,
  disabled,
}: {
  item: Omit<CartItem, "quantity">;
  disabled?: boolean;
}) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);

  return (
    <div className="flex items-center gap-2">
      <select
        className="input w-20"
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        disabled={disabled}
      >
        {Array.from({ length: Math.min(item.maxQuantity, 10) || 1 }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn-primary flex-1"
        disabled={disabled}
        onClick={() => addItem(item, qty)}
      >
        {disabled ? "Out of stock" : "Add to cart"}
      </button>
    </div>
  );
}
