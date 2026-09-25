import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page grid gap-8 py-10 lg:grid-cols-[220px_1fr]">
      <aside className="card-surface h-fit p-4">
        <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-black/40">Admin</p>
        <nav className="flex flex-col gap-1 text-sm font-medium">
          <Link href="/admin" className="rounded-lg px-3 py-2 hover:bg-black/5">Dashboard</Link>
          <Link href="/admin/cards" className="rounded-lg px-3 py-2 hover:bg-black/5">Cards</Link>
          <Link href="/admin/cards/new" className="rounded-lg px-3 py-2 hover:bg-black/5">Add card</Link>
          <Link href="/admin/import" className="rounded-lg px-3 py-2 hover:bg-black/5">CSV import</Link>
          <Link href="/admin/games" className="rounded-lg px-3 py-2 hover:bg-black/5">Games</Link>
          <Link href="/admin/sets" className="rounded-lg px-3 py-2 hover:bg-black/5">Sets & promos</Link>
          <Link href="/admin/orders" className="rounded-lg px-3 py-2 hover:bg-black/5">Orders</Link>
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}
