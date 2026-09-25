// Updates the admin account's password to the current SEED_ADMIN_PASSWORD in .env.
// The password is never printed. Run with: npm run db:set-admin-password
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@crithitgames.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password || password === "ChangeMe123!") {
    throw new Error("Set a new SEED_ADMIN_PASSWORD in .env first.");
  }
  if (password.length < 12) {
    throw new Error("Use at least 12 characters for the admin password.");
  }

  await prisma.user.update({
    where: { email },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`Password updated for ${email}.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
