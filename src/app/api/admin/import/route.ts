import { NextResponse } from "next/server";
import Papa from "papaparse";
import { Condition } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { slugify, generateSku } from "@/lib/utils";

const CONDITION_MAP: Record<string, Condition> = {
  NM: "NEAR_MINT",
  NEAR_MINT: "NEAR_MINT",
  "NEAR MINT": "NEAR_MINT",
  LP: "LIGHTLY_PLAYED",
  LIGHTLY_PLAYED: "LIGHTLY_PLAYED",
  "LIGHTLY PLAYED": "LIGHTLY_PLAYED",
  MP: "MODERATELY_PLAYED",
  MODERATELY_PLAYED: "MODERATELY_PLAYED",
  "MODERATELY PLAYED": "MODERATELY_PLAYED",
  HP: "HEAVILY_PLAYED",
  HEAVILY_PLAYED: "HEAVILY_PLAYED",
  "HEAVILY PLAYED": "HEAVILY_PLAYED",
  DMG: "DAMAGED",
  DAMAGED: "DAMAGED",
};

function parseCondition(raw: string): Condition | null {
  return CONDITION_MAP[raw.trim().toUpperCase()] ?? null;
}

function parseBoolean(raw: string | undefined) {
  if (!raw) return false;
  return ["true", "1", "yes", "y"].includes(raw.trim().toLowerCase());
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Attach a CSV file." }, { status: 400 });
  }

  const text = await file.text();
  const parsedCsv = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

  if (parsedCsv.errors.length > 0) {
    return NextResponse.json({ error: `CSV parse error: ${parsedCsv.errors[0].message}` }, { status: 400 });
  }

  const rows = parsedCsv.data;
  if (rows.length === 0) {
    return NextResponse.json({ error: "The CSV has no data rows." }, { status: 400 });
  }

  const batch = await prisma.csvImportBatch.create({
    data: {
      adminUserId: session.user.id,
      filename: (file as File).name || "import.csv",
      totalRows: rows.length,
      status: "PROCESSING",
    },
  });

  const errors: { row: number; message: string }[] = [];
  let successRows = 0;

  const gameCache = new Map<string, string>();
  const setCache = new Map<string, string>();
  const cardCache = new Map<string, string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // account for the header row

    try {
      const gameName = row.game?.trim();
      const setName = row.set?.trim();
      const cardName = row.name?.trim();
      if (!gameName || !setName || !cardName) {
        throw new Error("Columns game, set, and name are required.");
      }

      const condition = parseCondition(row.condition ?? "");
      if (!condition) throw new Error(`Unrecognized condition "${row.condition ?? ""}" (use NM/LP/MP/HP/DMG).`);

      const finish = row.finish?.trim() || "Normal";
      const language = row.language?.trim() || "English";
      const price = Number(row.price);
      const quantity = Number(row.quantity);
      if (!Number.isFinite(price) || price < 0) throw new Error(`Invalid price "${row.price}".`);
      if (!Number.isFinite(quantity) || quantity < 0) throw new Error(`Invalid quantity "${row.quantity}".`);

      const gameSlug = slugify(gameName);
      let gameId = gameCache.get(gameSlug);
      if (!gameId) {
        const game = await prisma.game.upsert({
          where: { slug: gameSlug },
          update: {},
          create: { name: gameName, slug: gameSlug },
        });
        gameId = game.id;
        gameCache.set(gameSlug, game.id);
      }

      const setSlug = slugify(setName);
      const setCacheKey = `${gameId}|${setSlug}`;
      let setId = setCache.get(setCacheKey);
      if (!setId) {
        const set = await prisma.cardSet.upsert({
          where: { gameId_slug: { gameId, slug: setSlug } },
          update: {},
          create: { gameId, name: setName, slug: setSlug, isPromo: parseBoolean(row.promo) },
        });
        setId = set.id;
        setCache.set(setCacheKey, set.id);
      }

      const collectorNumber = row.collector_number?.trim() || undefined;
      const baseCardSlug = slugify(collectorNumber ? `${cardName}-${collectorNumber}` : cardName);
      const cardCacheKey = `${setId}|${baseCardSlug}`;
      let cardId = cardCache.get(cardCacheKey);
      if (!cardId) {
        const card = await prisma.card.upsert({
          where: { setId_slug: { setId, slug: baseCardSlug } },
          update: {
            rarity: row.rarity?.trim() || undefined,
            cardType: row.card_type?.trim() || undefined,
            subType: row.sub_type?.trim() || undefined,
            description: row.description?.trim() || undefined,
            imageUrl: row.image_url?.trim() || undefined,
          },
          create: {
            setId,
            name: cardName,
            slug: baseCardSlug,
            collectorNumber,
            rarity: row.rarity?.trim() || undefined,
            cardType: row.card_type?.trim() || undefined,
            subType: row.sub_type?.trim() || undefined,
            description: row.description?.trim() || undefined,
            imageUrl: row.image_url?.trim() || undefined,
            isPromo: parseBoolean(row.promo),
          },
        });
        cardId = card.id;
        cardCache.set(cardCacheKey, card.id);
      }

      await prisma.cardVariant.upsert({
        where: { cardId_finish_condition_language: { cardId, finish, condition, language } },
        update: { priceCents: Math.round(price * 100), quantity },
        create: {
          cardId,
          finish,
          condition,
          language,
          priceCents: Math.round(price * 100),
          quantity,
          sku: row.sku?.trim() || generateSku(gameSlug, setSlug, baseCardSlug, finish, condition),
        },
      });

      successRows += 1;
    } catch (err: any) {
      errors.push({ row: rowNum, message: err.message ?? "Unknown error" });
    }
  }

  const status = errors.length === 0 ? "COMPLETED" : successRows > 0 ? "COMPLETED_WITH_ERRORS" : "FAILED";

  const finalBatch = await prisma.csvImportBatch.update({
    where: { id: batch.id },
    data: {
      status,
      successRows,
      errorRows: errors.length,
      errorLog: errors.length > 0 ? errors : undefined,
    },
  });

  return NextResponse.json({ batch: finalBatch, errors });
}
