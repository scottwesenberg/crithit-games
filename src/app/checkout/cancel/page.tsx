import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <div className="container-page flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-extrabold">Checkout canceled</h1>
      <p className="max-w-md text-black/60">
        No worries — nothing was charged. Your cart is still saved whenever you're ready.
      </p>
      <Link href="/cart" className="btn-primary">Back to cart</Link>
    </div>
  );
}
