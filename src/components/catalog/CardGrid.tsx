import CardTile, { type CardTileData } from "@/components/catalog/CardTile";

export default function CardGrid({ cards }: { cards: CardTileData[] }) {
  if (cards.length === 0) {
    return (
      <div className="card-surface flex flex-col items-center justify-center gap-2 p-16 text-center">
        <p className="text-lg font-semibold">No cards match those filters</p>
        <p className="text-sm text-black/50">Try widening your search or clearing a filter.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map((card) => (
        <CardTile key={card.slug} card={card} />
      ))}
    </div>
  );
}
