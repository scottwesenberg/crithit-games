import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/utils";
import Pagination from "@/components/catalog/Pagination";

export const dynamic = "force-dynamic";

export default async function AdminCardsPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = 30;
  const where = searchParams.q ? { name: { contains: searchParams.q, mode: "insensitive" as const } } : {};

  const [cards, total] = await Promise.all([
    prisma.card.findMany({
      where,
      include: { set: { include: { game: true } }, variants: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.card.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Cards ({total})</h1>
        <Link href="/admin/cards/new" className="btn-primary">Add card</Link>
      </div>

      <form className="mb-4">
        <input name="q" defaultValue={searchParams.q} placeholder="Search by name…" className="input max-w-sm" />
      </form>

      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left text-xs uppercase tracking-wide text-black/50">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Set</th>
              <th className="px-4 py-2">Variants</th>
              <th className="px-4 py-2">Stock</th>
              <th className="px-4 py-2">From</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {cards.map((c) => {
              const totalStock = c.variants.reduce((s, v) => s + v.quantity, 0);
              const lowest = c.variants.length ? Math.min(...c.variants.map((v) => v.priceCents)) : null;
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">
                    {c.name}
                    {c.isPromo && <span className="badge ml-2 bg-ember-500 text-white">Promo</span>}
                  </td>
                  <td className="px-4 py-3 text-black/60">{c.set.game.name} · {c.set.name}</td>
                  <td className="px-4 py-3 text-black/60">{c.variants.length}</td>
                  <td className="px-4 py-3 text-black/60">{totalStock}</td>
                  <td className="px-4 py-3 text-black/60">{lowest !== null ? formatCents(lowest) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/cards/${c.id}/edit`} className="text-brand-600 hover:underline">Edit</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} basePath="/admin/cards" searchParams={{ q: searchParams.q }} />
    </div>
  );
}
