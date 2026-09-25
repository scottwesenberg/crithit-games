import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { slugify } from "@/lib/utils";

const schema = z.object({
  gameId: z.string().min(1),
  name: z.string().min(1).max(160),
  code: z.string().max(30).optional().or(z.literal("")),
  releaseDate: z.string().optional().or(z.literal("")),
  isPromo: z.boolean().optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId") ?? undefined;

  const sets = await prisma.cardSet.findMany({
    where: gameId ? { gameId } : undefined,
    include: { game: true, _count: { select: { cards: true } } },
    orderBy: [{ isPromo: "asc" }, { releaseDate: "desc" }],
  });
  return NextResponse.json({ sets });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const slug = slugify(parsed.data.name);
  const existing = await prisma.cardSet.findUnique({
    where: { gameId_slug: { gameId: parsed.data.gameId, slug } },
  });
  if (existing) return NextResponse.json({ error: "A set with that name already exists for this game." }, { status: 409 });

  const set = await prisma.cardSet.create({
    data: {
      gameId: parsed.data.gameId,
      name: parsed.data.name,
      slug,
      code: parsed.data.code || undefined,
      releaseDate: parsed.data.releaseDate ? new Date(parsed.data.releaseDate) : undefined,
      isPromo: !!parsed.data.isPromo,
    },
  });

  return NextResponse.json({ set });
}
