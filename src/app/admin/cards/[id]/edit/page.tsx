import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CardForm, { type CardFormInitial } from "@/components/admin/CardForm";

export const dynamic = "force-dynamic";

export default async function EditCardPage({ params }: { params: { id: string } }) {
  const card = await prisma.card.findUnique({
    where: { id: params.id },
    include: { set: { include: { game: true } }, variants: true },
  });
  if (!card) notFound();

  const initial: CardFormInitial = {
    id: card.id,
    setId: card.setId,
    setLabel: `${card.set.game.name} — ${card.set.name}`,
    name: card.name,
    collectorNumber: card.collectorNumber ?? "",
    rarity: card.rarity ?? "",
    cardType: card.cardType ?? "",
    subType: card.subType ?? "",
    description: card.description ?? "",
    imageUrl: card.imageUrl ?? "",
    variants: card.variants.map((v) => ({
      id: v.id,
      finish: v.finish,
      condition: v.condition,
      language: v.language,
      price: (v.priceCents / 100).toFixed(2),
      quantity: String(v.quantity),
    })),
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold">Edit {card.name}</h1>
      <CardForm games={[]} initial={initial} />
    </div>
  );
}
