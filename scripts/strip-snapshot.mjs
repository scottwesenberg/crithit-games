// Removes account/order data from prisma/catalog-snapshot.sql so the committed snapshot only ever
// contains the public card catalog (games, sets, cards, variants) -- never user emails, password
// hashes, addresses, orders or tokens. `npm run db:snapshot` runs this automatically after the dump.
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../prisma/catalog-snapshot.sql", import.meta.url);
const SENSITIVE = ["User", "Address", "Order", "OrderItem", "EmailVerificationToken", "PasswordResetToken", "CsvImportBatch", "_prisma_migrations"];

const lines = readFileSync(file, "utf8").split(/\r?\n/);
const out = [];
let skipping = false;
const removed = {};

for (const line of lines) {
  if (skipping) {
    if (line === "\\.") skipping = false;
    continue;
  }
  const m = line.match(/^COPY public\."?([A-Za-z_]+)"? \(/);
  if (m && SENSITIVE.includes(m[1])) {
    skipping = true;
    removed[m[1]] = true;
    continue;
  }
  out.push(line);
}

writeFileSync(file, out.join("\n"));
console.log(`Stripped from snapshot: ${Object.keys(removed).join(", ") || "(nothing -- already clean)"}`);
