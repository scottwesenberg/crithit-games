import Link from "next/link";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page grid gap-8 py-10 lg:grid-cols-[220px_1fr]">
      <aside className="card-surface h-fit p-4">
        <nav className="flex flex-col gap-1 text-sm font-medium">
          <Link href="/account" className="rounded-lg px-3 py-2 hover:bg-black/5">Overview</Link>
          <Link href="/account/orders" className="rounded-lg px-3 py-2 hover:bg-black/5">Order history</Link>
          <Link href="/account/addresses" className="rounded-lg px-3 py-2 hover:bg-black/5">Addresses</Link>
          <Link href="/account/profile" className="rounded-lg px-3 py-2 hover:bg-black/5">Profile</Link>
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}
