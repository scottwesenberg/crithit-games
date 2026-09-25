import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/utils";
import { conditionLabel } from "@/lib/constants";
import AddToCartButton from "@/components/cart/AddToCartButton";

export const dynamic = "force-dynamic";

async function getCard(gameSlug: string, setSlug: string, cardSlug: string) {
  return prisma.card.findFirst({
    where: {
      slug: cardSlug,
      set: { slug: setSlug, game: { slug: gameSlug } },
    },
    include: {
      set: { include: { game: true } },
      variants: { orderBy: [{ finish: "asc" }, { condition: "asc" }] },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: { gameSlug: string; setSlug: string; cardSlug: string };
}) {
  const card = await getCard(params.gameSlug, params.setSlug, params.cardSlug);
  return { title: card ? `${card.name} — ${card.set.name}` : "Card not found" };
}

export default async function CardDetailPage({
  params,
}: {
  params: { gameSlug: string; setSlug: string; cardSlug: string };
}) {
  const card = await getCard(params.gameSlug, params.setSlug, params.cardSlug);
  if (!card) notFound();

  const attributes = (card.attributes as Record<string, string | number>) ?? {};

  return (
    <div className="container-page py-8">
      <nav className="mb-6 text-xs text-black/40">
        <Link href="/games" className="hover:underline">All games</Link> /{" "}
        <Link href={`/games/${card.set.game.slug}`} className="hover:underline">{card.set.game.name}</Link> /{" "}
        <Link href={`/games/${card.set.game.slug}/sets/${card.set.slug}`} className="hover:underline">
          {card.set.name}
        </Link>{" "}
        / {card.name}
      </nav>

      <div className="grid gap-10 lg:grid-cols-[380px_1fr]">
        <div className="card-surface flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 p-6">
          {card.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.imageUrl} alt={card.name} className="max-h-[520px] w-full object-contain" />
          ) : (
            <div className="flex h-96 w-full items-center justify-center text-center text-brand-700/60">
              {card.name}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {card.isPromo && <span className="badge bg-ember-500 text-white">Promo</span>}
            {card.rarity && <span className="badge bg-brand-100 text-brand-700">{card.rarity}</span>}
            {card.cardType && <span className="badge bg-black/5 text-ink-900">{card.cardType}</span>}
          </div>
          <h1 className="text-3xl font-extrabold">{card.name}</h1>
          <p className="mt-1 text-sm text-black/50">
            {card.set.name}
            {card.collectorNumber ? ` · #${card.collectorNumber}` : ""}
          </p>

          {card.description && <p className="mt-4 text-sm leading-relaxed text-black/70">{card.description}</p>}

          {Object.keys(attributes).length > 0 && (
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              {Object.entries(attributes).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs uppercase tracking-wide text-black/40">{key}</dt>
                  <dd className="font-medium text-ink-900">{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="card-surface mt-6 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-black/5 text-left text-xs uppercase tracking-wide text-black/50">
                <tr>
                  <th className="px-4 py-2">Finish</th>
                  <th className="px-4 py-2">Condition</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">Stock</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {card.variants.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-3 font-medium">{v.finish}</td>
                    <td className="px-4 py-3">{conditionLabel(v.condition)}</td>
                    <td className="px-4 py-3 font-semibold text-brand-700">{formatCents(v.priceCents)}</td>
                    <td className="px-4 py-3 text-black/60">
                      {v.quantity > 0 ? `${v.quantity} in stock` : "Out of stock"}
                    </td>
                    <td className="px-4 py-3">
                      <AddToCartButton
                        disabled={v.quantity === 0}
                        item={{
                          variantId: v.id,
                          cardSlug: card.slug,
                          gameSlug: card.set.game.slug,
                          setSlug: card.set.slug,
                          cardName: card.name,
                          setName: card.set.name,
                          finish: v.finish,
                          condition: v.condition,
                          priceCents: v.priceCents,
                          imageUrl: card.imageUrl,
                          maxQuantity: v.quantity,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
