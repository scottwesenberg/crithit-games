import { Prisma, Condition } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";
import type { CardTileData } from "@/components/catalog/CardTile";
import type { FilterOptions } from "@/components/catalog/FilterSidebar";

export type CatalogSearchParams = {
  set?: string;
  rarity?: string;
  cardType?: string;
  finish?: string;
  condition?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  promoOnly?: string;
  sort?: string;
  q?: string;
  page?: string;
};

export type CatalogScope = { gameSlug?: string; setSlug?: string };

function buildVariantFilter(params: CatalogSearchParams): Prisma.CardVariantWhereInput {
  const variantWhere: Prisma.CardVariantWhereInput = {};
  if (params.finish) variantWhere.finish = params.finish;
  if (params.condition) variantWhere.condition = params.condition as Condition;
  if (params.minPrice || params.maxPrice) {
    variantWhere.priceCents = {
      ...(params.minPrice ? { gte: Math.round(Number(params.minPrice) * 100) } : {}),
      ...(params.maxPrice ? { lte: Math.round(Number(params.maxPrice) * 100) } : {}),
    };
  }
  if (params.inStock === "1") {
    variantWhere.quantity = { gt: 0 };
  }
  return variantWhere;
}

function buildWhere(params: CatalogSearchParams, scope: CatalogScope): Prisma.CardWhereInput {
  const where: Prisma.CardWhereInput = {};

  const setWhere: Prisma.CardSetWhereInput = {};
  if (scope.gameSlug) setWhere.game = { slug: scope.gameSlug };
  if (scope.setSlug) setWhere.slug = scope.setSlug;
  if (params.set) setWhere.slug = params.set;
  if (Object.keys(setWhere).length > 0) where.set = { is: setWhere };

  if (params.rarity) where.rarity = params.rarity;
  if (params.cardType) where.cardType = params.cardType;
  if (params.promoOnly === "1") where.isPromo = true;
  if (params.q) where.name = { contains: params.q, mode: "insensitive" };

  const variantWhere = buildVariantFilter(params);
  if (Object.keys(variantWhere).length > 0) {
    where.variants = { some: variantWhere };
  }

  return where;
}

function toTile(
  card: Prisma.CardGetPayload<{ include: { set: { include: { game: true } }; variants: true } }>,
  params: CatalogSearchParams
): CardTileData {
  const variantWhere = buildVariantFilter(params);
  const relevant = card.variants.filter((v) => {
    if (variantWhere.finish && v.finish !== variantWhere.finish) return false;
    if (variantWhere.condition && v.condition !== variantWhere.condition) return false;
    const price = variantWhere.priceCents as { gte?: number; lte?: number } | undefined;
    if (price?.gte !== undefined && v.priceCents < price.gte) return false;
    if (price?.lte !== undefined && v.priceCents > price.lte) return false;
    const qty = variantWhere.quantity as { gt?: number } | undefined;
    if (qty?.gt !== undefined && !(v.quantity > qty.gt)) return false;
    return true;
  });
  const pool = relevant.length > 0 ? relevant : card.variants;
  const inStockPrices = pool.filter((v) => v.quantity > 0).map((v) => v.priceCents);
  const lowestPriceCents = inStockPrices.length > 0 ? Math.min(...inStockPrices) : null;
  const totalQuantity = pool.reduce((sum, v) => sum + v.quantity, 0);

  return {
    slug: card.slug,
    name: card.name,
    imageUrl: card.imageUrl,
    rarity: card.rarity,
    isPromo: card.isPromo,
    set: { name: card.set.name, slug: card.set.slug, game: { slug: card.set.game.slug, name: card.set.game.name } },
    lowestPriceCents,
    totalQuantity,
  };
}

export async function queryCatalog(params: CatalogSearchParams, scope: CatalogScope) {
  const where = buildWhere(params, scope);

  const cards = await prisma.card.findMany({
    where,
    include: { set: { include: { game: true } }, variants: true },
  });

  const tiles = cards.map((c) => toTile(c, params));

  const sort = params.sort ?? "name-asc";
  tiles.sort((a, b) => {
    switch (sort) {
      case "price-asc":
        return (a.lowestPriceCents ?? Infinity) - (b.lowestPriceCents ?? Infinity);
      case "price-desc":
        return (b.lowestPriceCents ?? -1) - (a.lowestPriceCents ?? -1);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "newest":
        return 0; // stable — cards already come back roughly in insertion order
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const page = Math.max(1, Number(params.page) || 1);
  const totalPages = Math.max(1, Math.ceil(tiles.length / PAGE_SIZE));
  const pageItems = tiles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return { items: pageItems, total: tiles.length, page, totalPages };
}

export async function getFilterOptions(scope: CatalogScope): Promise<FilterOptions> {
  const setWhere: Prisma.CardSetWhereInput = {};
  if (scope.gameSlug) setWhere.game = { slug: scope.gameSlug };
  if (scope.setSlug) setWhere.slug = scope.setSlug;

  const cardWhere: Prisma.CardWhereInput =
    Object.keys(setWhere).length > 0 ? { set: { is: setWhere } } : {};

  const [sets, rarities, cardTypes, finishes] = await Promise.all([
    scope.setSlug
      ? Promise.resolve([])
      : prisma.cardSet.findMany({
          where: setWhere,
          orderBy: [{ isPromo: "asc" }, { releaseDate: "desc" }],
          select: { slug: true, name: true, isPromo: true },
        }),
    prisma.card.findMany({ where: cardWhere, distinct: ["rarity"], select: { rarity: true } }),
    prisma.card.findMany({ where: cardWhere, distinct: ["cardType"], select: { cardType: true } }),
    prisma.cardVariant.findMany({
      where: Object.keys(cardWhere).length > 0 ? { card: cardWhere } : {},
      distinct: ["finish"],
      select: { finish: true },
    }),
  ]);

  return {
    sets,
    rarities: rarities.map((r) => r.rarity).filter((r): r is string => !!r).sort(),
    cardTypes: cardTypes.map((c) => c.cardType).filter((c): c is string => !!c).sort(),
    finishes: finishes.map((f) => f.finish).filter((f): f is string => !!f).sort(),
  };
}
