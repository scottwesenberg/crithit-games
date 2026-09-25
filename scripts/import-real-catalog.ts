// Pulls real card data (names, sets, rarities, real card images) from legitimate
// free developer APIs and populates the catalog with it, replacing the
// placeholder/fictional seed data. Safe to re-run (upserts everything).
//
// Sources:
//   Magic: The Gathering -> Scryfall API            https://scryfall.com/docs/api
//   Pokemon               -> Pokemon TCG API         https://docs.pokemontcg.io
//   Yu-Gi-Oh!             -> YGOPRODeck API           https://ygoprodeck.com/api-guide
//   Disney Lorcana        -> Lorcast API              https://lorcast.com/docs/api
//   One Piece Card Game   -> OPTCG API                https://optcgapi.com
//
// Run with: npm run db:import-real
//
// Each game import is wrapped so one game failing (network blip, an API being down) does not
// stop the others -- it's logged and skipped, and the run still finishes the rest.
//
// Tuning via env vars (all optional):
//   CARDS_PER_SET      how many cards to sample per set (default 20)
//   IMPORT_DELAY_MS     delay between API requests, be a good citizen (default 120)
//   POKEMONTCG_API_KEY  free key from pokemontcg.io raises pokemon rate limits a lot
//   GAMES               comma list to rebuild only specific games instead of everything,
//                       e.g. GAMES=lorcana,one-piece npm run db:import-real
//                       valid keys: magic, pokemon, yugioh, lorcana, one-piece
//                       (only the selected games are wiped/rebuilt -- the rest are left alone)

import { PrismaClient, Condition } from "@prisma/client";

const prisma = new PrismaClient();

const CARDS_PER_SET = Number(process.env.CARDS_PER_SET ?? 20);
const REQUEST_DELAY_MS = Number(process.env.IMPORT_DELAY_MS ?? 120);

const TODAY = new Date();
const TEN_YEARS_AGO = new Date();
TEN_YEARS_AGO.setFullYear(TEN_YEARS_AGO.getFullYear() - 10);

function slugify(input: string) {
  return input
    .toString()
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function sku(...parts: string[]) {
  return parts.join("-").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 120);
}

function capitalize(s: string) {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomQuantity() {
  return Math.floor(Math.random() * 12) + 1;
}

function centsFromPrice(value: string | number | null | undefined, fallbackCents: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallbackCents;
  return Math.max(10, Math.round(n * 100));
}

async function fetchJson(url: string, headers: Record<string, string> = {}, retries = 4): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "CritHitGames/1.0 (local dev import)", ...headers } });
      if (res.status === 429) {
        const wait = 2000 * attempt;
        console.warn(`  rate limited, waiting ${wait}ms: ${url}`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(800 * attempt);
    }
  }
}

async function upsertGame(name: string, description: string, sortOrder: number) {
  const slug = slugify(name);
  return prisma.game.upsert({
    where: { slug },
    update: { description, sortOrder },
    create: { name, slug, description, sortOrder },
  });
}

async function upsertSet(
  gameId: string,
  name: string,
  opts: { code?: string; releaseDate?: Date; isPromo?: boolean; iconUrl?: string }
) {
  const slug = slugify(name);
  return prisma.cardSet.upsert({
    where: { gameId_slug: { gameId, slug } },
    update: { code: opts.code, releaseDate: opts.releaseDate, iconUrl: opts.iconUrl, isPromo: !!opts.isPromo },
    create: { gameId, name, slug, code: opts.code, releaseDate: opts.releaseDate, isPromo: !!opts.isPromo, iconUrl: opts.iconUrl },
  });
}

function pickSample<T>(items: T[], cap: number): T[] {
  if (items.length <= cap) return items;
  const stride = items.length / cap;
  const result: T[] = [];
  for (let i = 0; i < cap; i++) result.push(items[Math.floor(i * stride)]);
  return result;
}

async function upsertCardWithVariant(
  setId: string,
  gameSlug: string,
  setSlug: string,
  data: {
    name: string;
    collectorNumber?: string;
    rarity?: string;
    cardType?: string;
    subType?: string;
    description?: string;
    imageUrl?: string | null;
    isPromo?: boolean;
    attributes?: Record<string, unknown>;
    priceCents: number;
    finish?: string;
  }
) {
  const baseSlug = slugify(data.collectorNumber ? `${data.name}-${data.collectorNumber}` : data.name);
  const card = await prisma.card.upsert({
    where: { setId_slug: { setId, slug: baseSlug } },
    update: {
      imageUrl: data.imageUrl ?? undefined,
      rarity: data.rarity,
      cardType: data.cardType,
      subType: data.subType,
      description: data.description,
      attributes: data.attributes as any,
    },
    create: {
      setId,
      name: data.name,
      slug: baseSlug,
      collectorNumber: data.collectorNumber,
      rarity: data.rarity,
      cardType: data.cardType,
      subType: data.subType,
      description: data.description,
      imageUrl: data.imageUrl ?? undefined,
      isPromo: !!data.isPromo,
      attributes: data.attributes as any,
    },
  });

  const finish = data.finish ?? "Normal";

  await prisma.cardVariant.upsert({
    where: { cardId_finish_condition_language: { cardId: card.id, finish, condition: Condition.NEAR_MINT, language: "English" } },
    update: { priceCents: data.priceCents },
    create: {
      cardId: card.id,
      finish,
      condition: Condition.NEAR_MINT,
      language: "English",
      priceCents: data.priceCents,
      quantity: randomQuantity(),
      sku: sku(gameSlug, setSlug, baseSlug, finish, "NM"),
    },
  });

  await prisma.cardVariant.upsert({
    where: { cardId_finish_condition_language: { cardId: card.id, finish, condition: Condition.LIGHTLY_PLAYED, language: "English" } },
    update: {},
    create: {
      cardId: card.id,
      finish,
      condition: Condition.LIGHTLY_PLAYED,
      language: "English",
      priceCents: Math.max(10, Math.round(data.priceCents * 0.75)),
      quantity: randomQuantity(),
      sku: sku(gameSlug, setSlug, baseSlug, finish, "LP"),
    },
  });

  return card;
}

async function addSealedProducts(
  game: { id: string; slug: string },
  cardSet: { id: string; slug: string; name: string },
  products: { label: string; priceCents: number }[]
) {
  for (const p of products) {
    const name = `${cardSet.name} ${p.label}`;
    const baseSlug = slugify(name);
    const card = await prisma.card.upsert({
      where: { setId_slug: { setId: cardSet.id, slug: baseSlug } },
      update: {},
      create: {
        setId: cardSet.id,
        name,
        slug: baseSlug,
        cardType: "Sealed Product",
        subType: p.label,
        description: `Sealed ${p.label.toLowerCase()} for ${cardSet.name}. No stock photo yet -- add one any time from Admin -> Cards -> Edit.`,
      },
    });
    await prisma.cardVariant.upsert({
      where: { cardId_finish_condition_language: { cardId: card.id, finish: "Sealed", condition: Condition.NEAR_MINT, language: "English" } },
      update: {},
      create: {
        cardId: card.id,
        finish: "Sealed",
        condition: Condition.NEAR_MINT,
        language: "English",
        priceCents: p.priceCents,
        quantity: Math.floor(Math.random() * 6) + 1,
        sku: sku(game.slug, cardSet.slug, baseSlug, "Sealed", "NM"),
      },
    });
  }
}

// ---------------- Magic: The Gathering (Scryfall) ----------------

async function importMagic() {
  console.log("\n=== Magic: The Gathering (Scryfall) ===");
  const game = await upsertGame(
    "Magic: The Gathering",
    "The original trading card game of planeswalkers, spells, and mana.",
    0
  );

  const setsResp = await fetchJson("https://api.scryfall.com/sets");
  const ALLOWED_TYPES = new Set([
    "expansion", "core", "masters", "draft_innovation", "commander", "starter",
    "box", "duel_deck", "from_the_vault", "premium_deck", "promo", "spellbook", "arsenal",
  ]);
  const sets = (setsResp.data as any[]).filter((s) => {
    if (!s.released_at || s.digital) return false;
    const rd = new Date(s.released_at);
    return rd >= TEN_YEARS_AGO && rd <= TODAY && ALLOWED_TYPES.has(s.set_type);
  });
  console.log(`Found ${sets.length} eligible sets`);

  for (const s of sets) {
    const cardSet = await upsertSet(game.id, s.name, {
      code: s.code?.toUpperCase(),
      releaseDate: new Date(s.released_at),
      isPromo: s.set_type === "promo",
      iconUrl: s.icon_svg_uri,
    });

    await sleep(REQUEST_DELAY_MS);
    let cards: any[] = [];
    try {
      let url = `https://api.scryfall.com/cards/search?q=set:${s.code}&order=set&unique=prints`;
      while (url) {
        const page = await fetchJson(url);
        cards.push(...(page.data ?? []));
        url = page.has_more ? page.next_page : "";
        if (url) await sleep(REQUEST_DELAY_MS);
      }
    } catch (err: any) {
      console.warn(`  skip ${s.name}: ${err.message}`);
      continue;
    }

    const sample = pickSample(cards, CARDS_PER_SET);
    for (const c of sample) {
      const imageUrl = c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null;
      const typeLine: string = c.type_line ?? "";
      await upsertCardWithVariant(cardSet.id, game.slug, cardSet.slug, {
        name: c.name,
        collectorNumber: c.collector_number,
        rarity: c.rarity ? capitalize(c.rarity) : undefined,
        cardType: typeLine.split("—")[0]?.trim() || undefined,
        description: c.oracle_text ?? c.card_faces?.[0]?.oracle_text,
        imageUrl,
        isPromo: s.set_type === "promo",
        attributes: c.mana_cost ? { "Mana Cost": c.mana_cost } : undefined,
        priceCents: centsFromPrice(c.prices?.usd, 50),
        finish: c.finishes?.includes("foil") && !c.finishes?.includes("nonfoil") ? "Foil" : "Normal",
      });
    }
    console.log(`  ${cardSet.name}: ${sample.length}/${cards.length} cards`);
    await sleep(REQUEST_DELAY_MS);
  }

  const recent = [...sets].sort((a, b) => +new Date(b.released_at) - +new Date(a.released_at)).slice(0, 6);
  for (const s of recent) {
    const cardSet = await prisma.cardSet.findUnique({ where: { gameId_slug: { gameId: game.id, slug: slugify(s.name) } } });
    if (!cardSet) continue;
    await addSealedProducts(game, cardSet, [
      { label: "Draft Booster Box", priceCents: 12999 },
      { label: "Set Booster Box", priceCents: 13999 },
      { label: "Collector Booster Box", priceCents: 29999 },
      { label: "Bundle", priceCents: 4499 },
    ]);
  }
}

// ---------------- Pokemon (pokemontcg.io) ----------------

async function importPokemon() {
  console.log("\n=== Pokemon (pokemontcg.io) ===");
  const game = await upsertGame(
    "Pokemon",
    "Catch, train, and battle with pocket monsters across every generation.",
    1
  );

  const headers: Record<string, string> = {};
  if (process.env.POKEMONTCG_API_KEY) headers["X-Api-Key"] = process.env.POKEMONTCG_API_KEY;

  const setsResp = await fetchJson("https://api.pokemontcg.io/v2/sets?pageSize=250", headers);
  const sets = (setsResp.data as any[]).filter((s) => {
    if (!s.releaseDate) return false;
    const rd = new Date(s.releaseDate.replace(/\//g, "-"));
    return rd >= TEN_YEARS_AGO && rd <= TODAY;
  });
  console.log(`Found ${sets.length} eligible sets`);

  for (const s of sets) {
    const cardSet = await upsertSet(game.id, s.name, {
      code: s.ptcgoCode ?? s.id,
      releaseDate: new Date(s.releaseDate.replace(/\//g, "-")),
      iconUrl: s.images?.symbol,
    });

    await sleep(REQUEST_DELAY_MS);
    let cards: any[] = [];
    try {
      let page = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const resp = await fetchJson(`https://api.pokemontcg.io/v2/cards?q=set.id:${s.id}&page=${page}&pageSize=250`, headers);
        cards.push(...(resp.data ?? []));
        if (!resp.data || resp.data.length < 250) break;
        page++;
        await sleep(REQUEST_DELAY_MS);
      }
    } catch (err: any) {
      console.warn(`  skip ${s.name}: ${err.message}`);
      continue;
    }

    const sample = pickSample(cards, CARDS_PER_SET);
    for (const c of sample) {
      const prices = c.tcgplayer?.prices;
      const marketPrice =
        prices?.holofoil?.market ?? prices?.normal?.market ?? prices?.reverseHolofoil?.market ?? prices?.["1stEditionHolofoil"]?.market;
      await upsertCardWithVariant(cardSet.id, game.slug, cardSet.slug, {
        name: c.name,
        collectorNumber: c.number,
        rarity: c.rarity,
        cardType: c.supertype,
        subType: c.subtypes?.[0],
        description: c.flavorText,
        imageUrl: c.images?.large ?? c.images?.small,
        attributes: c.hp ? { HP: c.hp, Type: c.types?.join("/") ?? "" } : undefined,
        priceCents: centsFromPrice(marketPrice, 40),
        finish: prices?.holofoil ? "Holofoil" : "Normal",
      });
    }
    console.log(`  ${cardSet.name}: ${sample.length}/${cards.length} cards`);
  }

  const recent = [...sets].sort((a, b) => +new Date(b.releaseDate) - +new Date(a.releaseDate)).slice(0, 6);
  for (const s of recent) {
    const cardSet = await prisma.cardSet.findUnique({ where: { gameId_slug: { gameId: game.id, slug: slugify(s.name) } } });
    if (!cardSet) continue;
    await addSealedProducts(game, cardSet, [
      { label: "Booster Box", priceCents: 14999 },
      { label: "Elite Trainer Box", priceCents: 4999 },
      { label: "Booster Bundle", priceCents: 2499 },
    ]);
  }
}

// ---------------- Yu-Gi-Oh! (YGOPRODeck) ----------------

async function importYugioh() {
  console.log("\n=== Yu-Gi-Oh! (YGOPRODeck) ===");
  const game = await upsertGame(
    "Yu-Gi-Oh!",
    "Duel with powerful monsters, spells, and traps in the Shadow Game.",
    2
  );

  const setsResp = await fetchJson("https://db.ygoprodeck.com/api/v7/cardsets.php");
  const sets = (setsResp as any[]).filter((s) => {
    if (!s.tcg_date) return false;
    const rd = new Date(s.tcg_date);
    return rd >= TEN_YEARS_AGO && rd <= TODAY;
  });
  console.log(`Found ${sets.length} eligible sets`);

  for (const s of sets) {
    const cardSet = await upsertSet(game.id, s.set_name, { code: s.set_code, releaseDate: new Date(s.tcg_date) });

    await sleep(REQUEST_DELAY_MS);
    let cards: any[] = [];
    try {
      const resp = await fetchJson(`https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(s.set_name)}`);
      cards = resp.data ?? [];
    } catch (err: any) {
      console.warn(`  skip ${s.set_name}: ${err.message}`);
      continue;
    }

    const sample = pickSample(cards, CARDS_PER_SET);
    for (const c of sample) {
      const setInfo = c.card_sets?.find((cs: any) => cs.set_name === s.set_name);
      const price = c.card_prices?.[0]?.tcgplayer_price;
      await upsertCardWithVariant(cardSet.id, game.slug, cardSet.slug, {
        name: c.name,
        collectorNumber: setInfo?.set_code,
        rarity: setInfo?.set_rarity,
        cardType: c.type,
        subType: c.race,
        description: c.desc,
        imageUrl: c.card_images?.[0]?.image_url,
        attributes: c.atk !== undefined ? { ATK: c.atk, DEF: c.def ?? "" } : undefined,
        priceCents: centsFromPrice(price, 30),
      });
    }
    console.log(`  ${cardSet.name}: ${sample.length}/${cards.length} cards`);
    await sleep(REQUEST_DELAY_MS);
  }

  const recent = [...sets].sort((a, b) => +new Date(b.tcg_date) - +new Date(a.tcg_date)).slice(0, 6);
  for (const s of recent) {
    const cardSet = await prisma.cardSet.findUnique({ where: { gameId_slug: { gameId: game.id, slug: slugify(s.set_name) } } });
    if (!cardSet) continue;
    await addSealedProducts(game, cardSet, [
      { label: "Booster Box", priceCents: 8999 },
      { label: "Special Edition", priceCents: 1499 },
    ]);
  }
}

// ---------------- Disney Lorcana (Lorcast) ----------------

async function importLorcana() {
  console.log("\n=== Disney Lorcana (Lorcast) ===");
  const game = await upsertGame(
    "Disney Lorcana",
    "Illumineer your way through an all-new trading card game of Disney magic.",
    3
  );

  const setsResp = await fetchJson("https://api.lorcast.com/v0/sets");
  const allSets = setsResp.results ?? setsResp.data ?? setsResp;
  const sets = (allSets as any[]).filter((s) => {
    if (!s.released_at) return false;
    const rd = new Date(s.released_at);
    return rd >= TEN_YEARS_AGO && rd <= TODAY;
  });
  console.log(`Found ${sets.length} eligible sets`);

  for (const s of sets) {
    const cardSet = await upsertSet(game.id, s.name, { code: s.code?.toUpperCase(), releaseDate: new Date(s.released_at) });

    await sleep(REQUEST_DELAY_MS);
    let cards: any[] = [];
    try {
      const resp = await fetchJson(`https://api.lorcast.com/v0/cards/search?q=set:${s.code}`);
      cards = resp.results ?? resp.data ?? [];
    } catch (err: any) {
      console.warn(`  skip ${s.name}: ${err.message}`);
      continue;
    }

    const sample = pickSample(cards, CARDS_PER_SET);
    for (const c of sample) {
      try {
        await upsertCardWithVariant(cardSet.id, game.slug, cardSet.slug, {
          name: c.version ? `${c.name} - ${c.version}` : c.name,
          collectorNumber: c.collector_number,
          rarity: c.rarity ? capitalize(c.rarity) : undefined,
          cardType: Array.isArray(c.type) ? c.type[0] : c.type,
          subType: Array.isArray(c.classifications) ? c.classifications[0] : c.classifications,
          description: c.text,
          imageUrl: c.image_uris?.digital?.normal,
          attributes: c.cost !== undefined ? { Cost: c.cost, Ink: c.ink ?? "" } : undefined,
          priceCents: centsFromPrice(c.prices?.usd, 35),
        });
      } catch (err: any) {
        console.warn(`  skip card "${c?.name ?? "?"}" in ${s.name}: ${err.message}`);
      }
    }
    console.log(`  ${cardSet.name}: ${sample.length}/${cards.length} cards`);
    await sleep(REQUEST_DELAY_MS);
  }

  const recent = [...sets].sort((a, b) => +new Date(b.released_at) - +new Date(a.released_at)).slice(0, 4);
  for (const s of recent) {
    const cardSet = await prisma.cardSet.findUnique({ where: { gameId_slug: { gameId: game.id, slug: slugify(s.name) } } });
    if (!cardSet) continue;
    await addSealedProducts(game, cardSet, [
      { label: "Booster Box", priceCents: 14400 },
      { label: "Booster Pack", priceCents: 499 },
    ]);
  }
}

// ---------------- One Piece Card Game (OPTCG API) ----------------

async function importOnePiece() {
  console.log("\n=== One Piece Card Game (OPTCG API) ===");
  const game = await upsertGame(
    "One Piece Card Game",
    "Set sail with the Straw Hats and rivals from across the Grand Line in Bandai's One Piece Card Game.",
    4
  );

  // OPTCG's set list has no release date, but the game itself launched in 2022 -- every
  // official set is inside our 10-year window already, so there is nothing to date-filter.
  const setsResp = await fetchJson("https://optcgapi.com/api/allSets/");
  const rawSets = (setsResp?.results ?? setsResp?.data ?? setsResp) as any[];
  const sets = Array.isArray(rawSets) ? rawSets.filter((s) => s?.set_id && s?.set_name) : [];
  console.log(`Found ${sets.length} sets`);

  for (const s of sets) {
    const cardSet = await upsertSet(game.id, s.set_name, { code: String(s.set_id).toUpperCase() });

    await sleep(REQUEST_DELAY_MS);
    let cards: any[] = [];
    try {
      const resp = await fetchJson(`https://optcgapi.com/api/sets/${encodeURIComponent(s.set_id)}/`);
      const rawCards = (resp?.results ?? resp?.data ?? resp) as any[];
      cards = Array.isArray(rawCards) ? rawCards : [];
    } catch (err: any) {
      console.warn(`  skip ${s.set_name}: ${err.message}`);
      continue;
    }

    const sample = pickSample(cards, CARDS_PER_SET);
    for (const c of sample) {
      try {
        await upsertCardWithVariant(cardSet.id, game.slug, cardSet.slug, {
          name: c.card_name,
          collectorNumber: c.card_set_id,
          rarity: c.rarity || undefined,
          cardType: c.card_type || undefined,
          subType: c.sub_types || c.card_color || undefined,
          description: c.card_text || undefined,
          imageUrl: c.card_image || undefined,
          attributes:
            c.card_cost || c.card_power || c.life
              ? { Cost: c.card_cost ?? "", Power: c.card_power ?? "", Life: c.life ?? "", Color: c.card_color ?? "" }
              : undefined,
          priceCents: centsFromPrice(c.market_price ?? c.inventory_price, 40),
        });
      } catch (err: any) {
        console.warn(`  skip card "${c?.card_name ?? "?"}" in ${s.set_name}: ${err.message}`);
      }
    }
    console.log(`  ${cardSet.name}: ${sample.length}/${cards.length} cards`);
    await sleep(REQUEST_DELAY_MS);
  }

  const recent = [...sets].sort((a, b) => String(b.set_id).localeCompare(String(a.set_id))).slice(0, 4);
  for (const s of recent) {
    const cardSet = await prisma.cardSet.findUnique({ where: { gameId_slug: { gameId: game.id, slug: slugify(s.set_name) } } });
    if (!cardSet) continue;
    await addSealedProducts(game, cardSet, [
      { label: "Booster Box", priceCents: 10900 },
      { label: "Starter Deck", priceCents: 1200 },
    ]);
  }
}

// ---------------- Main ----------------

const GAME_IMPORTERS: { key: string; slug: string; label: string; run: () => Promise<void> }[] = [
  { key: "magic", slug: "magic-the-gathering", label: "Magic: The Gathering", run: importMagic },
  { key: "pokemon", slug: "pokemon", label: "Pokemon", run: importPokemon },
  { key: "yugioh", slug: "yu-gi-oh", label: "Yu-Gi-Oh!", run: importYugioh },
  { key: "lorcana", slug: "disney-lorcana", label: "Disney Lorcana", run: importLorcana },
  { key: "one-piece", slug: "one-piece-card-game", label: "One Piece Card Game", run: importOnePiece },
];

async function main() {
  console.log(`Importing real cards for sets released between ${TEN_YEARS_AGO.toISOString().slice(0, 10)} and today.`);
  console.log(`Sampling up to ${CARDS_PER_SET} cards per set (tune with CARDS_PER_SET env var).`);

  const requested = (process.env.GAMES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const runAll = requested.length === 0;
  const selected = runAll ? GAME_IMPORTERS : GAME_IMPORTERS.filter((g) => requested.includes(g.key));

  if (!runAll && selected.length === 0) {
    console.error(`GAMES="${process.env.GAMES}" matched nothing. Valid keys: ${GAME_IMPORTERS.map((g) => g.key).join(", ")}`);
    process.exit(1);
  }

  if (runAll) {
    console.log("\nClearing placeholder catalog data (games/sets/cards/variants) -- accounts and orders are untouched...");
    const deleted = await prisma.game.deleteMany({});
    console.log(`Cleared ${deleted.count} game(s) and everything under them.`);
  } else {
    console.log(`\nGAMES filter set -- only rebuilding: ${selected.map((g) => g.label).join(", ")} (everything else is left alone)`);
    for (const g of selected) {
      const deleted = await prisma.game.deleteMany({ where: { slug: g.slug } });
      if (deleted.count) console.log(`  cleared existing "${g.label}" data first`);
    }
  }

  const failed: string[] = [];
  for (const g of selected) {
    try {
      await g.run();
    } catch (err: any) {
      console.error(`\n!!! ${g.label} import failed, skipping it and continuing with the rest: ${err?.message ?? err}`);
      failed.push(g.key);
    }
  }

  const [gameCount, setCount, cardCount, variantCount] = await Promise.all([
    prisma.game.count(),
    prisma.cardSet.count(),
    prisma.card.count(),
    prisma.cardVariant.count(),
  ]);
  console.log(`\nDone! ${gameCount} games, ${setCount} sets, ${cardCount} cards, ${variantCount} purchasable variants.`);
  if (failed.length) {
    console.log(`\nThese failed and were skipped: ${failed.join(", ")}`);
    console.log(`Retry just them with: GAMES=${failed.join(",")} npm run db:import-real`);
  }
  console.log("Refresh the site, or run \`npm run db:studio\` to browse the data.");
}

main()
  .catch((e) => {
    console.error("\nImport failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
