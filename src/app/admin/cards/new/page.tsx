import { prisma } from "@/lib/prisma";
import CardForm from "@/components/admin/CardForm";

export const dynamic = "force-dynamic";

export default async function NewCardPage() {
  const games = await prisma.game.findMany({
    orderBy: { sortOrder: "asc" },
    include: { sets: { orderBy: [{ isPromo: "asc" }, { name: "asc" }], select: { id: true, name: true, isPromo: true } } },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold">Add a card</h1>
      {games.length === 0 ? (
        <p className="text-sm text-black/50">
          Create a game and a set first from the Games / Sets pages, then come back here.
        </p>
      ) : (
        <CardForm games={games} />
      )}
    </div>
  );
}
