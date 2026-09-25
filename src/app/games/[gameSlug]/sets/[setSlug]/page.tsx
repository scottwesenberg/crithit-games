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

export async function generateMetadata({ params }: { params: { gameSlug: string; setSlug: string } }) {
  const set = await prisma.cardSet.findFirst({
    where: { slug: params.setSlug, game: { slug: params.gameSlug } },
  });
  return { title: set ? set.name : "Set not found" };
}

export default async function SetBrowsePage({
  params,
  searchParams,
}: {
  params: { gameSlug: string; setSlug: string };
  searchParams: CatalogSearchParams;
}) {
  const set = await prisma.cardSet.findFirst({
    where: { slug: params.setSlug, game: { slug: params.gameSlug } },
    include: { game: true },
  });
  if (!set) notFound();

  const scope = { gameSlug: params.gameSlug, setSlug: params.setSlug };
  const [{ items, page, totalPages, total }, options] = await Promise.all([
    queryCatalog(searchParams, scope),
    getFilterOptions(scope),
  ]);

  return (
    <div className="container-page py-8">
      <nav className="mb-2 text-xs text-black/40">
        <Link href="/games" className="hover:underline">All games</Link> /{" "}
        <Link href={`/games/${params.gameSlug}`} className="hover:underline">{set.game.name}</Link> / {set.name}
      </nav>
      <h1 className="mb-1 text-2xl font-extrabold">{set.name}</h1>
      {set.isPromo && <p className="mb-4 text-sm font-medium text-ember-600">Promo release</p>}

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
              basePath={`/games/${params.gameSlug}/sets/${params.setSlug}`}
              searchParams={searchParams as Record<string, string | undefined>}
            />
          </div>
        </div>
      </Suspense>
    </div>
  );
}
