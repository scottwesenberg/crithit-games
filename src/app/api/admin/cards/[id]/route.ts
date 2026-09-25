import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { generateSku } from "@/lib/utils";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const card = await prisma.card.findUnique({
    where: { id: params.id },
    include: { set: { include: { game: true } }, variants: true },
  });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ card });
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  collectorNumber: z.string().max(30).optional().or(z.literal("")),
  rarity: z.string().max(60).optional().or(z.literal("")),
  cardType: z.string().max(80).optional().or(z.literal("")),
  subType: z.string().max(80).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  imageUrl: z.string().url().optional().or(z.literal("")),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        finish: z.string().min(1).max(40),
        condition: z.enum(["NEAR_MINT", "LIGHTLY_PLAYED", "MODERATELY_PLAYED", "HEAVILY_PLAYED", "DAMAGED"]),
        language: z.string().min(1).max(30).default("English"),
        priceCents: z.number().int().nonnegative(),
        quantity: z.number().int().nonnegative(),
      })
    )
    .optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.card.findUnique({
    where: { id: params.id },
    include: { set: { include: { game: true } }, variants: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { variants, ...cardFields } = parsed.data;

  await prisma.card.update({
    where: { id: params.id },
    data: {
      ...(cardFields.name !== undefined ? { name: cardFields.name } : {}),
      collectorNumber: cardFields.collectorNumber || undefined,
      rarity: cardFields.rarity || undefined,
      cardType: cardFields.cardType || undefined,
      subType: cardFields.subType || undefined,
      description: cardFields.description || undefined,
      imageUrl: cardFields.imageUrl || undefined,
    },
  });

  if (variants) {
    const keepIds = variants.filter((v) => v.id).map((v) => v.id as string);
    await prisma.cardVariant.deleteMany({ where: { cardId: params.id, id: { notIn: keepIds } } });

    for (const v of variants) {
      if (v.id) {
        await prisma.cardVariant.update({
          where: { id: v.id },
          data: {
            finish: v.finish,
            condition: v.condition,
            language: v.language,
            priceCents: v.priceCents,
            quantity: v.quantity,
          },
        });
      } else {
        await prisma.cardVariant.create({
          data: {
            cardId: params.id,
            finish: v.finish,
            condition: v.condition,
            language: v.language,
            priceCents: v.priceCents,
            quantity: v.quantity,
            sku: generateSku(existing.set.game.slug, existing.set.slug, existing.slug, v.finish, v.condition),
          },
        });
      }
    }
  }

  const updated = await prisma.card.findUnique({
    where: { id: params.id },
    include: { set: { include: { game: true } }, variants: true },
  });

  return NextResponse.json({ card: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.card.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
