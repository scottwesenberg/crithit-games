import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { queryCatalog, getFilterOptions, type CatalogSearchParams } from "@/lib/catalog";
import CardGrid from "@/components/catalog/CardGrid";
import FilterSidebar from "@/components/catalog/FilterSidebar";
import SortSelect from "@/components/catalog/SortSelect";
import Pagination from "@/components/catalog/Pagination";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { gameSlug: string } }) {
  const game = await prisma.game.findUnique({ where: { slug: params.gameSlug } });
  return { title: game ? game.name : "Game not found" };
}

export default async function GameBrowsePage({
  params,
  searchParams,
}: {
  params: { gameSlug: string };
  searchParams: CatalogSearchParams;
}) {
  const game = await prisma.game.findUnique({ where: { slug: params.gameSlug } });
  if (!game) notFound();

  const scope = { gameSlug: params.gameSlug };
  const [{ items, page, totalPages, total }, options] = await Promise.all([
    queryCatalog(searchParams, scope),
    getFilterOptions(scope),
  ]);

  return (
    <div className="container-page py-8">
      <nav className="mb-2 text-xs text-black/40">
        <Link href="/games" className="hover:underline">All games</Link> / {game.name}
      </nav>
      <h1 className="mb-6 text-2xl font-extrabold">{game.name}</h1>

      <Suspense fallback={null}>
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <FilterSidebar options={options} current={searchParams} />
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-black/50">{total} card{total === 1 ? "" : "s"}</p>
              <SortSelect />
            </div>
            <CardGrid cards={items} />
            <Pagination
              page={page}
              totalPages={totalPages}
              basePath={`/games/${params.gameSlug}`}
              searchParams={searchParams as Record<string, string | undefined>}
            />
          </div>
        </div>
      </Suspense>
    </div>
  );
}
