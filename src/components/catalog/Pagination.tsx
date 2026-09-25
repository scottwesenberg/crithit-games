import Link from "next/link";

export default function Pagination({
  page,
  totalPages,
  basePath,
  searchParams,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  function hrefFor(p: number) {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2
  );

  return (
    <nav className="mt-8 flex items-center justify-center gap-1 text-sm">
      <Link
        href={hrefFor(Math.max(1, page - 1))}
        className={`btn-ghost ${page === 1 ? "pointer-events-none opacity-40" : ""}`}
      >
        Prev
      </Link>
      {pages.map((p, idx) => (
        <span key={p} className="flex items-center gap-1">
          {idx > 0 && pages[idx - 1] !== p - 1 && <span className="px-1 text-black/30">…</span>}
          <Link
            href={hrefFor(p)}
            className={`btn-ghost min-w-[2.25rem] justify-center ${
              p === page ? "bg-brand-600 text-white hover:bg-brand-600" : ""
            }`}
          >
            {p}
          </Link>
        </span>
      ))}
      <Link
        href={hrefFor(Math.min(totalPages, page + 1))}
        className={`btn-ghost ${page === totalPages ? "pointer-events-none opacity-40" : ""}`}
      >
        Next
      </Link>
    </nav>
  );
}
