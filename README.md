# CritHit Games

A full-stack trading card singles & sealed product storefront built with Next.js, Prisma/PostgreSQL, NextAuth, and Stripe.

Card catalog is organized as **Game → Set → Card → Variant**. A "promo" drop (e.g. prerelease promos, Black
Star Promos) is modeled the same way real singles sites do it: it's just a `CardSet` flagged `isPromo`, so
promo cards live in a set and are filterable exactly like any other set. Each `Card` can have multiple
purchasable `CardVariant`s — one row per finish × condition × language — each with its own price and stock,
which is how the same card ends up with several prices (Near Mint foil vs. Lightly Played non-foil, etc.).

## About this project

CritHit Games is a portfolio project built by Scott Wesenberg ([Mitten Web Works](https://mittenwebworks.com)).
It is a working demo, not a live store: no real customers, orders, or payment data are stored, and checkout runs
in Stripe test mode only. The demo accounts and sample data in this repo are placeholders.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **PostgreSQL** via **Prisma ORM**
- **NextAuth (Auth.js) v4** — email/password accounts with a custom email-verification flow (Credentials
  provider, JWT sessions; sign-in is blocked until the address is verified)
- **Stripe Checkout** for payment, with a webhook that marks orders paid and decrements stock
- **Nodemailer** for transactional email (verification, password reset, order confirmation) — point it at any
  SMTP provider (Postmark, SES, Mailgun, SendGrid SMTP, Gmail app password, etc.)
- **PapaParse** for the admin CSV bulk-import tool

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Copy env vars and fill them in (see below)
cp .env.example .env

# 3. Start a local Postgres (or point DATABASE_URL at one you already have)
docker compose up -d

# 4. Create the schema
npm run db:migrate

# 5. Seed demo data (games, sets, ~150 cards, an admin account, a demo customer)
npm run db:seed

# 6. Run it
npm run dev
```

Visit `http://localhost:3000`. The seed script prints an admin login (`admin@crithitgames.com` by default —
set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env` to change it) and a demo customer login
(`demo@crithitgames.com` / `DemoPass123!`) that already has a saved address and one past order, so you can see
the order-history page without checking out first.

## Environment variables

See `.env.example` for the full list with comments. You'll need:

- `DATABASE_URL` — Postgres connection string.
- `NEXTAUTH_SECRET` — random 32-byte secret (`openssl rand -base64 32`).
- `APP_URL` / `NEXTAUTH_URL` — the site's base URL (`http://localhost:3000` locally).
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` — from the
  [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) (test mode keys to start).
- `EMAIL_SERVER_HOST` / `_PORT` / `_USER` / `_PASSWORD` / `EMAIL_FROM` — SMTP credentials. If left blank, the
  app logs the verification/reset/receipt emails to the server console instead of sending them, so you can still
  develop locally without an SMTP account (copy the verify link out of the terminal).

## Setting up Stripe

1. Create a Stripe account and switch to **test mode**.
2. Copy the test **Secret key** and **Publishable key** into `.env`.
3. For local development, install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   It prints a `whsec_...` value — put that in `STRIPE_WEBHOOK_SECRET`.
4. In production, add a webhook endpoint in the Stripe Dashboard pointing at
   `https://your-domain.com/api/webhooks/stripe`, subscribed to `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, and `checkout.session.expired`. Copy its signing secret into
   `STRIPE_WEBHOOK_SECRET` on your host.
5. Test cards: `4242 4242 4242 4242`, any future expiry, any CVC.

Checkout is guest-friendly — Stripe collects the shipping address and, for guests, the email address, during
the Checkout flow itself. Signed-in shoppers' orders are tied to their account automatically; guest orders are
tracked by email in the `Order.guestEmail` field (there's no guest order-lookup page yet — that'd be a good
next feature to add if you need it).

## Accounts, verification & admin access

- **Registration** creates the user immediately but leaves `emailVerified` null and sends a verification email
  (24-hour token). Sign-in is refused until that link is clicked.
- **Password reset** uses a separate one-hour token, requested from `/forgot-password`.
- **Roles**: every user has `role: USER` or `role: ADMIN`. There's no self-serve way to become an admin — promote
  someone with Prisma Studio (`npm run db:studio`) or a one-off script, or just use the seeded admin account.
  `/admin/*` pages and `/api/admin/*` routes both check for `role === ADMIN` (the page-level check happens in
  `src/middleware.ts`, the API-level check happens per-route via `src/lib/adminGuard.ts` — defense in depth).

## Admin: adding inventory

Two ways to get cards into the catalog, both under **Admin → Cards**:

1. **Add card** — a form for one card at a time, with as many finish/condition price rows ("variants") as you
   need.
2. **CSV import** — bulk upload. Games, sets, and cards that don't exist yet are created automatically; a row
   for a card you already have updates its price/quantity instead of duplicating it. Expected columns:

   ```
   game, set, promo, name, collector_number, rarity, card_type, sub_type, description, image_url,
   finish, condition, language, price, quantity, sku
   ```

   `condition` accepts `NM`/`LP`/`MP`/`HP`/`DMG`. `promo` is `TRUE`/`FALSE`. One row = one finish/condition
   variant, so a card with a foil and non-foil printing is two rows with the same `name`/`collector_number`.
   A starter template is downloadable right from the `/admin/import` page (`public/templates/card-import-template.csv`).

A promo release is just a set — create one from **Admin → Sets & promos** with "This is a promo set" checked
(or set `promo=TRUE` on CSV rows for a new set name), then add/import cards into it like any other set.

### Loading the real catalog (one-time)

`npm run db:import-real` pulls real sets, cards, and images from free public APIs — Scryfall (Magic), the
Pokémon TCG API, YGOPRODeck (Yu-Gi-Oh!), Lorcast (Lorcana), and the OPTCG API (One Piece Card Game) — covering
every set released in the last 10 years per game (One Piece launched in 2022, so all of its sets qualify), a
sampled subset of cards per set, and popular sealed products (booster boxes, ETBs, bundles) on recent sets. It
takes a few minutes since it deliberately rate-limits itself to be polite to those free APIs. Tune it with env
vars `CARDS_PER_SET` (default 20) and `IMPORT_DELAY_MS` (default 120).

You only need to run this once. The data lands in Postgres (the Docker volume `crithit-db-data`), which
persists independently of `node_modules`, the dev server, or the project folder — reinstalling packages or
restarting `npm run dev` never touches it.

To make spinning up a fresh environment (a clean database, a new machine, after `docker compose down -v`)
instant instead of re-hitting those APIs, freeze the loaded catalog to a file once:

```bash
npm run db:snapshot   # dumps the current catalog to prisma/catalog-snapshot.sql
```

Then on any fresh database, skip the live import and restore from that file in seconds:

```bash
npm run db:migrate    # create the (empty) schema
npm run db:restore    # load prisma/catalog-snapshot.sql back in
```

Re-run `db:import-real` (then `db:snapshot` again) only when you actually want to refresh the catalog with
newer sets down the road.

Each game import runs independently — if one fails (a flaky network call, an API being briefly down), it's
logged and skipped without stopping the others. To rebuild just one or two games instead of everything (handy
after fixing a bug, or adding a game later), set `GAMES` to a comma list of `magic`, `pokemon`, `yugioh`,
`lorcana`, `one-piece`:

```bash
GAMES=lorcana,one-piece npm run db:import-real
```

Only the listed games are wiped and rebuilt; everything else in the catalog is left untouched.

## Catalog & filtering

Browse pages live at `/games/[game]`, `/games/[game]/sets/[set]`, and `/search`, all sharing the same filter
sidebar and query logic in `src/lib/catalog.ts`: filter by set, rarity, card type, finish, condition, price
range, in-stock-only, and promos-only, plus sort by name/price/newest. Filtering happens in the database via
Prisma `where` clauses; because the same card can have many variants at different prices, sorting by price and
sorting/pagination after a variant-level filter is applied happens in-memory after the query (see the comments
in `catalog.ts`). That's fine for a catalog of thousands of cards; if you grow into the tens of thousands,
consider adding a denormalized `minPriceCents` column on `Card` (updated whenever a variant changes) so price
sorting and pagination can happen entirely in SQL.

## Deploying

A common, inexpensive setup:

- **App**: [Vercel](https://vercel.com) (or any Node host that supports Next.js).
- **Database**: [Neon](https://neon.tech) or [Supabase](https://supabase.com) Postgres, or Vercel Postgres.
- **Email**: [Postmark](https://postmarkapp.com) or [Resend's SMTP](https://resend.com) work well.

Steps:

1. Push this repo to GitHub and import it into Vercel.
2. Add all the variables from `.env.example` in the Vercel project settings (use your production Stripe keys
   once you're out of test mode, and a production `DATABASE_URL`).
3. Set the Vercel build command to `npm run build` (default) — `postinstall` already runs `prisma generate`.
4. Run `npx prisma migrate deploy` against the production database once (locally with `DATABASE_URL` pointed at
   prod, or as a one-off Vercel deploy hook / GitHub Action step).
5. Run `npm run db:seed` once if you want the demo catalog in production too — more realistically, you'll skip
   the seed and populate the real catalog via CSV import from the admin panel instead.
6. Point the Stripe webhook at your live domain (see above).

## Project structure

```
prisma/schema.prisma        Data model (Game, CardSet, Card, CardVariant, User, Order, ...)
prisma/seed.ts               Demo data generator
src/lib/                     Prisma client, auth config, Stripe client, mailer, catalog query logic, zod schemas
src/middleware.ts             Route protection for /admin and /account
src/components/               Navbar/Footer, cart, catalog (grid/filters/pagination), admin forms
src/app/                      Pages (App Router) + API routes under src/app/api/**
public/logo-*.svg             Brand marks
public/templates/             Downloadable CSV import template
```

## Brand

**CritHit Games** — "Crack a pack. Hit a crit." Logo and favicon are hand-drawn SVGs in `public/` (a die-facet
hexagon with a lightning-bolt "crit" spark), so they're free to restyle without any image licensing concerns.
Brand colors live in `tailwind.config.ts` under `brand` (indigo/violet) and `ember` (orange accent).

## Troubleshooting

Since this codebase couldn't be compiled in the environment it was written in, here's what to check if
`npm run build` turns up something:

- **Prisma client types out of date** — run `npm run db:generate` (or just `npm install`, which runs it via
  `postinstall`) after any `schema.prisma` change.
- **"useSearchParams() should be wrapped in a suspense boundary"** — the filter/sort/login/reset-password
  components that call this hook are already wrapped in `<Suspense>` in their pages; if you add a new one,
  wrap it the same way.
- **Stripe webhook signature errors locally** — make sure `stripe listen` is running and that
  `STRIPE_WEBHOOK_SECRET` matches the secret it printed, not the Dashboard's production one.
- **Emails not arriving in dev** — if `EMAIL_SERVER_HOST` is unset, emails are printed to the terminal instead
  of sent; copy the verification/reset link from the server logs.

## Possible next steps

- Guest order lookup by order number + email (orders are already tracked with `guestEmail`, just no lookup UI yet).
- Wishlists / saved searches.
- A "sell to us" buylist flow, if you want to mirror that side of GameNerdz too.
- Real card images — `Card.imageUrl` and `CardVariant` are ready for them; seed data ships without images to
  avoid using anyone else's card art.
