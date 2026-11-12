"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = { placeholder: string; onSubmitted?: () => void };

/** Search box that keeps the current search term visible while you're on the results page. */
export default function SearchBar({ placeholder, onSubmitted }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = pathname === "/search" ? searchParams.get("q") ?? "" : "";
  const [query, setQuery] = useState(urlQuery);

  // Follow the URL: show the term on /search (including back/forward), clear it elsewhere.
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = query.trim();
        router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
        onSubmitted?.();
      }}
    >
      <input
        type="search"
        name="q"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="input"
      />
    </form>
  );
}
