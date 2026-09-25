"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useCart } from "@/components/cart/CartProvider";

const GAME_LINKS = [
  { name: "Magic: The Gathering", slug: "magic-the-gathering" },
  { name: "Pokemon", slug: "pokemon" },
  { name: "Yu-Gi-Oh!", slug: "yu-gi-oh" },
  { name: "Disney Lorcana", slug: "disney-lorcana" },
];

export default function Navbar() {
  const { data: session } = useSession();
  const { itemCount, open } = useCart();
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-full.svg" alt="CritHit Games" className="h-9 w-auto" />
        </Link>

        <form action="/search" className="hidden flex-1 max-w-xl md:block">
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards, sets, or products…"
            className="input"
          />
        </form>

        <nav className="ml-auto hidden items-center gap-5 text-sm font-medium lg:flex">
          {GAME_LINKS.map((g) => (
            <Link key={g.slug} href={`/games/${g.slug}`} className="hover:text-brand-600">
              {g.name}
            </Link>
          ))}
          <Link href="/games" className="hover:text-brand-600">
            All games
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          {session ? (
            <div className="hidden items-center gap-3 sm:flex">
              <Link href="/account" className="text-sm font-medium hover:text-brand-600">
                {session.user.name?.split(" ")[0] ?? "Account"}
              </Link>
              {session.user.role === "ADMIN" && (
                <Link href="/admin" className="text-sm font-medium text-ember-600 hover:underline">
                  Admin
                </Link>
              )}
              <button onClick={() => signOut()} className="text-sm text-black/50 hover:text-black">
                Sign out
              </button>
            </div>
          ) : (
            <Link href="/login" className="hidden text-sm font-medium hover:text-brand-600 sm:block">
              Sign in
            </Link>
          )}

          <button
            onClick={open}
            className="btn-secondary relative"
            aria-label="Open cart"
          >
            Cart
            {itemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ember-500 text-xs font-bold text-white">
                {itemCount}
              </span>
            )}
          </button>

          <button
            className="lg:hidden btn-ghost"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            ☰
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-black/5 lg:hidden">
          <div className="container-page flex flex-col gap-3 py-4 text-sm font-medium">
            <form action="/search">
              <input type="search" name="q" placeholder="Search…" className="input" />
            </form>
            {GAME_LINKS.map((g) => (
              <Link key={g.slug} href={`/games/${g.slug}`} onClick={() => setMobileOpen(false)}>
                {g.name}
              </Link>
            ))}
            <Link href="/games" onClick={() => setMobileOpen(false)}>
              All games
            </Link>
            {session ? (
              <>
                <Link href="/account" onClick={() => setMobileOpen(false)}>
                  My account
                </Link>
                {session.user.role === "ADMIN" && (
                  <Link href="/admin" onClick={() => setMobileOpen(false)}>
                    Admin
                  </Link>
                )}
                <button className="text-left text-black/50" onClick={() => signOut()}>
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
