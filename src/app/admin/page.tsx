import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [cardCount, orderCount, lowStock, pendingOrders] = await Promise.all([
    prisma.card.count(),
    prisma.order.count(),
    prisma.cardVariant.count({ where: { quantity: { lte: 3, gt: 0 } } }),
    prisma.order.count({ where: { status: "PAID" } }),
  ]);

  const stats = [
    { label: "Cards in catalog", value: cardCount, href: "/admin/cards" },
    { label: "Total orders", value: orderCount, href: "/admin/orders" },
    { label: "Orders awaiting fulfillment", value: pendingOrders, href: "/admin/orders" },
    { label: "Variants low on stock (≤3)", value: lowStock, href: "/admin/cards" },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card-surface p-5">
            <p className="text-3xl font-extrabold text-brand-700">{s.value}</p>
            <p className="mt-1 text-sm text-black/50">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 card-surface p-5">
        <h2 className="mb-2 font-bold">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/cards/new" className="btn-primary">Add a card manually</Link>
          <Link href="/admin/import" className="btn-secondary">Bulk import via CSV</Link>
          <Link href="/admin/sets" className="btn-secondary">Create a set / promo drop</Link>
        </div>
      </div>
    </div>
  );
}
