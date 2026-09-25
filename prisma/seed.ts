import { PrismaClient, Condition } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function sku(...parts: string[]) {
  return parts.join("-").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 120);
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

type GameSpec = {
  name: string;
  description: string;
  rarities: string[];
  cardTypes: string[];
  adjectives: string[];
  nouns: string[];
};

const GAME_SPECS: GameSpec[] = [
  {
    name: "Magic: The Gathering",
    description: "The original trading card game of planeswalkers, spells, and mana.",
    rarities: ["Common", "Uncommon", "Rare", "Mythic Rare"],
    cardTypes: ["Creature", "Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker", "Land"],
    adjectives: ["Ember", "Moss", "Tide", "Storm", "Gloom", "Sun", "Iron", "Shadow", "Frost", "Verdant"],
    nouns: ["Warden", "Wyrm", "Acolyte", "Sentinel", "Harbinger", "Druid", "Knight", "Elemental", "Oracle", "Marauder"],
  },
  {
    name: "Pokemon",
    description: "Catch, train, and battle with pocket monsters across every generation.",
    rarities: ["Common", "Uncommon", "Rare", "Rare Holo", "Ultra Rare", "Secret Rare"],
    cardTypes: ["Pokémon", "Trainer", "Energy"],
    adjectives: ["Pyre", "Aqua", "Volt", "Leaf", "Glaci", "Dusk", "Spark", "Terra", "Luna", "Crystal"],
    nouns: ["let", "bun", "mouse", "kit", "fang", "paw", "wing", "tail", "shell", "cub"],
  },
  {
    name: "Yu-Gi-Oh!",
    description: "Duel with powerful monsters, spells, and traps in the Shadow Game.",
    rarities: ["Common", "Rare", "Super Rare", "Ultra Rare", "Secret Rare"],
    cardTypes: ["Monster", "Spell", "Trap"],
    adjectives: ["Cyber", "Phantom", "Mecha", "Chaos", "Void", "Crimson", "Steel", "Abyssal", "Solar", "Rune"],
    nouns: ["Dragon", "Blade", "Serpent", "Golem", "Knight", "Sentinel", "Reaper", "Guardian", "Wyrm", "Colossus"],
  },
  {
    name: "Disney Lorcana",
    description: "Illumineer your way through an all-new trading card game of Disney magic.",
    rarities: ["Common", "Uncommon", "Rare", "Super Rare", "Legendary"],
    cardTypes: ["Character", "Action", "Item", "Location"],
    adjectives: ["Gentle", "Wandering", "Radiant", "Cunning", "Whispering", "Golden", "Silver", "Bright", "Quiet", "Bold"],
    nouns: ["Fox", "Lantern", "Voyager", "Minstrel", "Gardener", "Tinker", "Weaver", "Sailor", "Keeper", "Dreamer"],
  },
];

const FINISHES = ["Normal", "Foil"];

async function main() {
  console.log("Seeding CritHit Games demo data…");

  // ---- Admin + demo customer ----
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@crithitgames.com").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Store Admin",
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });
  console.log(`Admin: ${admin.email} / ${adminPassword}`);

  const demoPassword = "DemoPass123!";
  const demo = await prisma.user.upsert({
    where: { email: "demo@crithitgames.com" },
    update: {},
    create: {
      name: "Demo Customer",
      email: "demo@crithitgames.com",
      passwordHash: await bcrypt.hash(demoPassword, 12),
      role: "USER",
      emailVerified: new Date(),
    },
  });
  console.log(`Demo customer: ${demo.email} / ${demoPassword}`);

  await prisma.address.upsert({
    where: { id: "seed-demo-address" },
    update: {},
    create: {
      id: "seed-demo-address",
      userId: demo.id,
      label: "Home",
      fullName: "Demo Customer",
      line1: "123 Playtest Ave",
      city: "Columbus",
      state: "OH",
      postalCode: "43215",
      country: "US",
      isDefault: true,
    },
  });

  // ---- Catalog ----
  let sortOrder = 0;
  let firstOrderVariant: { id: string; priceCents: number; cardName: string; setName: string; finish: string; condition: Condition } | null = null;

  for (const spec of GAME_SPECS) {
    const gameSlug = slugify(spec.name);
    const game = await prisma.game.upsert({
      where: { slug: gameSlug },
      update: {},
      create: { name: spec.name, slug: gameSlug, description: spec.description, sortOrder: sortOrder++ },
    });

    const setDefs = [
      { name: `${spec.name.split(":")[0]} Core Set`, isPromo: false, daysAgo: 400 },
      { name: `${spec.name.split(":")[0]} Rising Skies`, isPromo: false, daysAgo: 60 },
      { name: `${spec.name.split(":")[0]} 2026 Black Star Promos`, isPromo: true, daysAgo: 20 },
    ];

    for (const setDef of setDefs) {
      const setSlug = slugify(setDef.name);
      const set = await prisma.cardSet.upsert({
        where: { gameId_slug: { gameId: game.id, slug: setSlug } },
        update: {},
        create: {
          gameId: game.id,
          name: setDef.name,
          slug: setSlug,
          isPromo: setDef.isPromo,
          releaseDate: new Date(Date.now() - setDef.daysAgo * 24 * 60 * 60 * 1000),
        },
      });

      const cardCount = setDef.isPromo ? 6 : 12;
      for (let i = 0; i < cardCount; i++) {
        const name =
          spec.name === "Pokemon"
            ? `${pick(spec.adjectives, i)}${pick(spec.nouns, i + 3)}`
            : `${pick(spec.adjectives, i)} ${pick(spec.nouns, i + 3)}`;
        const collectorNumber = String(i + 1).padStart(3, "0");
        const cardSlug = slugify(`${name}-${collectorNumber}`);
        const rarity = setDef.isPromo ? "Promo" : pick(spec.rarities, i);
        const cardType = pick(spec.cardTypes, i);

        const card = await prisma.card.upsert({
          where: { setId_slug: { setId: set.id, slug: cardSlug } },
          update: {},
          create: {
            setId: set.id,
            name,
            slug: cardSlug,
            collectorNumber,
            rarity,
            cardType,
            isPromo: setDef.isPromo,
            description: `A ${rarity.toLowerCase()} ${cardType.toLowerCase()} from ${set.name}.`,
            attributes: spec.name === "Magic: The Gathering" ? { "Mana Cost": `${(i % 6) + 1}`, Power: `${(i % 5) + 1}`, Toughness: `${(i % 4) + 1}` } : undefined,
          },
        });

        const finishesForCard = rarity.includes("Rare") || setDef.isPromo ? FINISHES : [FINISHES[0]];

        for (const finish of finishesForCard) {
          const basePrice = 25 + i * 15 + (finish === "Foil" ? 150 : 0) + (setDef.isPromo ? 300 : 0);
          const variant = await prisma.cardVariant.upsert({
            where: {
              cardId_finish_condition_language: {
                cardId: card.id,
                finish,
                condition: Condition.NEAR_MINT,
                language: "English",
              },
            },
            update: {},
            create: {
              cardId: card.id,
              finish,
              condition: Condition.NEAR_MINT,
              language: "English",
              priceCents: basePrice,
              quantity: (i * 3 + (finish === "Foil" ? 2 : 7)) % 15,
              sku: sku(gameSlug, setSlug, cardSlug, finish, "NM"),
            },
          });

          // Also stock a lightly-played copy at a discount for variety.
          await prisma.cardVariant.upsert({
            where: {
              cardId_finish_condition_language: {
                cardId: card.id,
                finish,
                condition: Condition.LIGHTLY_PLAYED,
                language: "English",
              },
            },
            update: {},
            create: {
              cardId: card.id,
              finish,
              condition: Condition.LIGHTLY_PLAYED,
              language: "English",
              priceCents: Math.round(basePrice * 0.75),
              quantity: (i * 2) % 8,
              sku: sku(gameSlug, setSlug, cardSlug, finish, "LP"),
            },
          });

          if (!firstOrderVariant && finish === "Normal") {
            firstOrderVariant = {
              id: variant.id,
              priceCents: variant.priceCents,
              cardName: card.name,
              setName: set.name,
              finish,
              condition: Condition.NEAR_MINT,
            };
          }
        }
      }
    }
  }

  // ---- Sample paid order for the demo customer ----
  if (firstOrderVariant) {
    const existingOrder = await prisma.order.findUnique({ where: { orderNumber: "CHG-SEED-0001" } });
    if (!existingOrder) {
      await prisma.order.create({
        data: {
          orderNumber: "CHG-SEED-0001",
          userId: demo.id,
          status: "FULFILLED",
          subtotalCents: firstOrderVariant.priceCents * 2,
          shippingCents: 499,
          taxCents: Math.round(firstOrderVariant.priceCents * 2 * 0.07),
          totalCents: firstOrderVariant.priceCents * 2 + 499 + Math.round(firstOrderVariant.priceCents * 2 * 0.07),
          shippingAddressSnapshot: {
            name: "Demo Customer",
            address: { line1: "123 Playtest Ave", city: "Columbus", state: "OH", postal_code: "43215", country: "US" },
          },
          items: {
            create: {
              cardVariantId: firstOrderVariant.id,
              cardName: firstOrderVariant.cardName,
              setName: firstOrderVariant.setName,
              finish: firstOrderVariant.finish,
              condition: firstOrderVariant.condition,
              unitPriceCents: firstOrderVariant.priceCents,
              quantity: 2,
            },
          },
        },
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
