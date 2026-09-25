import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CardGrid from "@/components/catalog/CardGrid";
import { queryCatalog } from "@/lib/catalog";
import { SITE_TAGLINE } from "@/lib/constants";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FAN_ROTATIONS = [-16, -9, -3, 4, 11, 17, -12, 7];

type BigHit = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  priceCents: number;
  setSlug: string;
  gameSlug: string;
};

// Highest-priced cards for a game -- real "big hits" pulled from actual variant pricing,
// deduped to one entry per card (a card can have several priced variants).
async function topBigHits(gameId: string, take: number): Promise<BigHit[]> {
  const variants = await prisma.cardVariant.findMany({
    where: {
      card: {
        imageUrl: { not: null },
        cardType: { not: "Sealed Product" },
        set: { gameId },
      },
    },
    orderBy: { priceCents: "desc" },
    take: take * 4, // headroom since multiple variants can point at the same card
    select: {
      priceCents: true,
      card: {
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
          set: { select: { slug: true, game: { select: { slug: true } } } },
        },
      },
    },
  });

  const seen = new Set<string>();
  const hits: BigHit[] = [];
  for (const v of variants) {
    if (seen.has(v.card.id) || !v.card.imageUrl) continue;
    seen.add(v.card.id);
    hits.push({
      id: v.card.id,
      name: v.card.name,
      slug: v.card.slug,
      imageUrl: v.card.imageUrl,
      priceCents: v.priceCents,
      setSlug: v.card.set.slug,
      gameSlug: v.card.set.game.slug,
    });
    if (hits.length >= take) break;
  }
  return hits;
}

// A random sample of real Pokemon cards priced above a threshold (real CardVariant pricing,
// not a fixed "top N") -- reshuffled on every homepage load so the hero fan isn't the exact
// same eight cards every visit.
async function randomHighValuePokemon(gameId: string, minCents: number, take: number): Promise<BigHit[]> {
  const variants = await prisma.cardVariant.findMany({
    where: {
      priceCents: { gte: minCents },
      card: {
        imageUrl: { not: null },
        cardType: { not: "Sealed Product" },
        set: { gameId },
      },
    },
    select: {
      priceCents: true,
      card: {
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
          set: { select: { slug: true, game: { select: { slug: true } } } },
        },
      },
    },
  });

  const seen = new Set<string>();
  const pool: BigHit[] = [];
  for (const v of variants) {
    if (seen.has(v.card.id) || !v.card.imageUrl) continue;
    seen.add(v.card.id);
    pool.push({
      id: v.card.id,
      name: v.card.name,
      slug: v.card.slug,
      imageUrl: v.card.imageUrl,
      priceCents: v.priceCents,
      setSlug: v.card.set.slug,
      gameSlug: v.card.set.game.slug,
    });
  }

  // Fisher-Yates shuffle -- a genuinely random sample, not just the priciest ones in order.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, take);
}

// Round-robins several games' lists together so the marquee alternates games as it scrolls
// instead of running through one game's cards in a single block.
function interleave<T>(lists: T[][]): T[] {
  const result: T[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      if (list[i]) result.push(list[i]);
    }
  }
  return result;
}

function hrefFor(hit: BigHit) {
  return `/card/${hit.gameSlug}/${hit.setSlug}/${hit.slug}`;
}

export default async function HomePage() {
  const [games, promoDrop] = await Promise.all([
    prisma.game.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { sets: true } } } }),
    queryCatalog({ promoOnly: "1", sort: "newest" }, {}),
  ]);

  const featured = await queryCatalog({ sort: "price-desc" }, {});

  // Real card art already licensed for display via the catalog's own data sources -- reused
  // here for a livelier homepage instead of any newly generated artwork. Pulled by actual
  // sale price, so these are genuine high-value "big hits", not a random sample.
  const gameHitLists = await Promise.all(games.map((g) => topBigHits(g.id, 8)));
  const hitsByGameSlug: Record<string, BigHit[]> = {};
  games.forEach((g, i) => {
    hitsByGameSlug[g.slug] = gameHitLists[i];
  });

  // $200 floor left only 5 real (non-sealed) Pokemon cards in the current catalog -- barely
  // enough to fill the fan and not enough to feel random on refresh. $100 currently has 16,
  // giving 7-of-16 real variety across page loads.
  const pokemonGame = games.find((g) => g.slug === "pokemon");
  const heroCards = pokemonGame ? await randomHighValuePokemon(pokemonGame.id, 10_000, 7) : [];
  const marqueeSource = interleave(games.map((g) => hitsByGameSlug[g.slug] ?? []));
  const marqueeLoop = marqueeSource.length > 0 ? [...marqueeSource, ...marqueeSource] : [];
  const gameSampleMap: Record<string, string | null> = {};
  games.forEach((g) => {
    gameSampleMap[g.slug] = hitsByGameSlug[g.slug]?.[0]?.imageUrl ?? null;
  });

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-ink-900 text-white">
        <div className="container-page grid gap-8 py-16 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
              Crack a pack.<br />Hit a crit.
            </h1>
            <p className="mt-4 max-w-md text-brand-100">{SITE_TAGLINE}</p>
            <div className="mt-6 flex gap-3">
              <Link href="/games" className="btn bg-white text-brand-700 hover:bg-brand-50">
                Shop all games
              </Link>
              <Link href="/register" className="btn bg-ember-500 text-white hover:bg-ember-600">
                Create an account
              </Link>
            </div>
          </div>

          {heroCards.length > 0 ? (
            // A real grid column from `md` up (tablet and desktop) -- never stacks below the
            // text, it's just not there at all on phones. Sized in em, driven by the text-[..]
            // font-size per breakpoint, so all 7 cards (size, gaps, tilt) shrink together as
            // the column tightens, reaching full size only at `lg`; nothing is dropped to fit.
            <div className="relative hidden w-fit justify-self-center md:block md:text-[9px] lg:text-base">
              <div className="absolute inset-0 -z-10 rounded-full bg-ember-400/30 blur-3xl" />
              <div className="relative h-[18em] w-[31em]">
                {heroCards.slice(0, 7).map((c, i) => (
                  <Link
                    key={c.id}
                    href={hrefFor(c)}
                    title={`${c.name} — ${formatCents(c.priceCents)}`}
                    className="hero-fan-card absolute block h-[12em] w-[9em] overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/20"
                    style={
                      {
                        left: `${i * 3.25}em`,
                        top: `${(i % 2) * 1.875}em`,
                        zIndex: i,
                        "--tilt": `${FAN_ROTATIONS[i % FAN_ROTATIONS.length]}deg`,
                      } as unknown as React.CSSProperties
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.imageUrl} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="hidden justify-self-center md:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-mark.svg"
                alt=""
                className="h-40 w-40 drop-shadow-2xl lg:h-56 lg:w-56"
              />
            </div>
          )}
        </div>
      </section>

      {marqueeLoop.length > 0 && (
        <section className="overflow-hidden border-y border-black/5 bg-white py-4">
          <div className="marquee-track flex w-max animate-marquee gap-4">
            {marqueeLoop.map((c, i) => (
              <Link
                key={`${c.id}-${i}`}
                href={hrefFor(c)}
                title={`${c.name} — ${formatCents(c.priceCents)}`}
                className="group block h-32 w-24 shrink-0 overflow-hidden rounded-lg shadow-card ring-1 ring-black/5 transition hover:-translate-y-1 hover:ring-2 hover:ring-brand-400"
              >
                <div className="relative h-full w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.imageUrl} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-1 py-0.5 text-center text-[10px] font-bold text-white">
                    {formatCents(c.priceCents)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container-page py-10">
        <h2 className="mb-4 text-xl font-bold">Shop by game</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {games.map((g) => {
            const sample = gameSampleMap[g.slug];
            return (
              <Link
                key={g.slug}
                href={`/games/${g.slug}`}
                className="card-surface group relative flex flex-col items-center gap-1 overflow-hidden p-6 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                {sample && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sample}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full scale-110 object-cover opacity-15 blur-[1px] transition group-hover:opacity-25"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/85 to-white/50" />
                <span className="relative text-lg font-bold text-brand-700">{g.name}</span>
                <span className="relative text-xs text-black/50">{g._count.sets} sets</span>
              </Link>
            );
          })}
        </div>
      </section>

      {promoDrop.items.length > 0 && (
        <section className="container-page py-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Latest promos</h2>
            <Link href="/games" className="text-sm font-medium text-brand-600 hover:underline">
              Browse all
            </Link>
          </div>
          <CardGrid cards={promoDrop.items.slice(0, 5)} />
        </section>
      )}

      <section className="container-page py-10">
        <h2 className="mb-4 text-xl font-bold">Chase cards</h2>
        <CardGrid cards={featured.items.slice(0, 10)} />
      </section>
    </div>
  );
}
