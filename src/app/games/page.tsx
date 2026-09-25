import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "All games" };

export default async function GamesPage() {
  const games = await prisma.game.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { sets: true } } },
  });

  return (
    <div className="container-page py-10">
      <h1 className="mb-6 text-2xl font-extrabold">All games</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => (
          <Link
            key={g.slug}
            href={`/games/${g.slug}`}
            className="card-surface flex flex-col gap-2 p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span className="text-lg font-bold text-brand-700">{g.name}</span>
            {g.description && <p className="text-sm text-black/60">{g.description}</p>}
            <span className="text-xs text-black/40">{g._count.sets} sets available</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
