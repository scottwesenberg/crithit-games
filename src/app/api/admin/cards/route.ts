import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { cardSchema } from "@/lib/validations";
import { slugify, generateSku } from "@/lib/utils";

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = 30;

  const where = q ? { name: { contains: q, mode: "insensitive" as const } } : {};

  const [cards, total] = await Promise.all([
    prisma.card.findMany({
      where,
      include: { set: { include: { game: true } }, variants: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.card.count({ where }),
  ]);

  return NextResponse.json({ cards, total, page, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = cardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid card" }, { status: 400 });
  }

  const set = await prisma.cardSet.findUnique({ where: { id: parsed.data.setId }, include: { game: true } });
  if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });

  const baseSlug = slugify(
    parsed.data.collectorNumber ? `${parsed.data.name}-${parsed.data.collectorNumber}` : parsed.data.name
  );
  let slug = baseSlug;
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (await prisma.card.findUnique({ where: { setId_slug: { setId: set.id, slug } } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const card = await prisma.card.create({
    data: {
      setId: set.id,
      name: parsed.data.name,
      slug,
      collectorNumber: parsed.data.collectorNumber || undefined,
      rarity: parsed.data.rarity || undefined,
      cardType: parsed.data.cardType || undefined,
      subType: parsed.data.subType || undefined,
      description: parsed.data.description || undefined,
      imageUrl: parsed.data.imageUrl || undefined,
      isPromo: set.isPromo,
      variants: {
        create: parsed.data.variants.map((v) => ({
          finish: v.finish,
          condition: v.condition,
          language: v.language,
          priceCents: v.priceCents,
          quantity: v.quantity,
          sku: generateSku(set.game.slug, set.slug, slug, v.finish, v.condition),
        })),
      },
    },
    include: { variants: true },
  });

  return NextResponse.json({ card });
}
