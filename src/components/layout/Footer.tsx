import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-black/5 bg-ink-950 text-white/70">
      <div className="container-page grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt={SITE_NAME} className="mb-3 h-10 w-10" />
          <p className="text-sm">
            Singles, sealed product, and tabletop gear for people who read the rules twice.
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Shop</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/games">All games</Link></li>
            <li><Link href="/search">Search</Link></li>
            <li><Link href="/cart">Cart</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Account</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/account">My account</Link></li>
            <li><Link href="/account/orders">Order history</Link></li>
            <li><Link href="/register">Create account</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Support</h3>
          <ul className="space-y-2 text-sm">
            <li>Mon–Fri, 9am–6pm ET</li>
            <li>Demo store &mdash; no live support</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/40">
        <p>
          {SITE_NAME} is a portfolio demo project, not a real retailer. It is not affiliated with, endorsed by, or
          sponsored by Wizards of the Coast, Nintendo, The Pokémon Company, Konami, Disney, Ravensburger, or Bandai.
          Card names and images are trademarks and property of their respective owners and are shown for demonstration
          only, sourced from public community APIs (Scryfall, Pokémon TCG API, YGOPRODeck, Lorcast, OPTCG API).
        </p>
        <p className="mt-2">© {new Date().getFullYear()} {SITE_NAME} demo.</p>
      </div>
    </footer>
  );
}
