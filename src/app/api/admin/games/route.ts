import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { slugify } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().or(z.literal("")),
});

export async function GET() {
  const games = await prisma.game.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { sets: true } } },
  });
  return NextResponse.json({ games });
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
  const existing = await prisma.game.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: "A game with that name already exists." }, { status: 409 });

  const game = await prisma.game.create({
    data: { name: parsed.data.name, slug, description: parsed.data.description || undefined },
  });

  return NextResponse.json({ game });
}
