// Deletes the seeded demo customer, its address, and the sample seed order(s) from whatever database
// DATABASE_URL points at (run it against production after any seed/restore that included demo data).
// Run with: npm run db:remove-demo
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.deleteMany({ where: { orderNumber: { startsWith: "CHG-SEED-" } } });
  const users = await prisma.user.deleteMany({ where: { email: "demo@crithitgames.com" } });
  const addresses = await prisma.address.deleteMany({ where: { id: "seed-demo-address" } });
  console.log(`Removed ${users.count} demo user(s), ${addresses.count} leftover address(es), ${orders.count} seed order(s).`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
