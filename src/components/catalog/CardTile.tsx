import Link from "next/link";
import { formatCents } from "@/lib/utils";

export type CardTileData = {
  slug: string;
  name: string;
  imageUrl: string | null;
  rarity: string | null;
  isPromo: boolean;
  set: { name: string; slug: string; game: { slug: string; name: string } };
  lowestPriceCents: number | null;
  totalQuantity: number;
};

export default function CardTile({ card }: { card: CardTileData }) {
  const href = `/card/${card.set.game.slug}/${card.set.slug}/${card.slug}`;
  const inStock = card.totalQuantity > 0;

  return (
    <Link
      href={href}
      className="card-surface group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[5/7] w-full bg-gradient-to-br from-brand-50 to-brand-100">
        {card.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.imageUrl}
            alt={card.name}
            className="h-full w-full object-contain p-2"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-xs text-brand-700/60">
            {card.name}
          </div>
        )}
        {card.isPromo && (
          <span className="badge absolute left-2 top-2 bg-ember-500 text-white">Promo</span>
        )}
        {!inStock && (
          <span className="badge absolute right-2 top-2 bg-black/70 text-white">Out of stock</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink-950 group-hover:text-brand-700">
          {card.name}
        </p>
        <p className="text-xs text-black/50">{card.set.name}</p>
        {card.rarity && <p className="text-xs text-black/40">{card.rarity}</p>}
        <div className="mt-auto pt-2 text-sm font-bold text-brand-700">
          {card.lowestPriceCents !== null ? (
            <>from {formatCents(card.lowestPriceCents)}</>
          ) : (
            <span className="text-black/40">Unavailable</span>
          )}
        </div>
      </div>
    </Link>
  );
}
