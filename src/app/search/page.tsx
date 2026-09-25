import { Suspense } from "react";
import { queryCatalog, getFilterOptions, type CatalogSearchParams } from "@/lib/catalog";
import CardGrid from "@/components/catalog/CardGrid";
import FilterSidebar from "@/components/catalog/FilterSidebar";
import SortSelect from "@/components/catalog/SortSelect";
import Pagination from "@/components/catalog/Pagination";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: CatalogSearchParams }) {
  const [{ items, page, totalPages, total }, options] = await Promise.all([
    queryCatalog(searchParams, {}),
    getFilterOptions({}),
  ]);

  return (
    <div className="container-page py-8">
      <h1 className="mb-6 text-2xl font-extrabold">
        {searchParams.q ? `Results for "${searchParams.q}"` : "Search"}
      </h1>

      <Suspense fallback={null}>
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <FilterSidebar options={options} current={searchParams} />
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-black/50">{total} result{total === 1 ? "" : "s"}</p>
              <SortSelect />
            </div>
            <CardGrid cards={items} />
            <Pagination
              page={page}
              totalPages={totalPages}
              basePath="/search"
              searchParams={searchParams as Record<string, string | undefined>}
            />
          </div>
        </div>
      </Suspense>
    </div>
  );
}
