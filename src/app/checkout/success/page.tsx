"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "@/components/cart/CartProvider";

export default function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { order?: string };
}) {
  const { clear } = useCart();

  useEffect(() => {
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container-page flex flex-col items-center gap-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✓</div>
      <h1 className="text-2xl font-extrabold">Order confirmed!</h1>
      <p className="max-w-md text-black/60">
        {searchParams.order
          ? `Order ${searchParams.order} is confirmed. A receipt is on its way to your inbox.`
          : "Your payment went through and your order is confirmed."}
      </p>
      <div className="mt-2 flex gap-3">
        <Link href="/account/orders" className="btn-primary">View my orders</Link>
        <Link href="/games" className="btn-secondary">Keep shopping</Link>
      </div>
    </div>
  );
}
