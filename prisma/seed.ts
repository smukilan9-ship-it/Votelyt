import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

/**
 * Seeds the bootstrap superadmin and backfills any ownerless elections to it.
 * Idempotent — safe to run repeatedly. Run with: `node prisma/seed.ts`.
 */
async function main() {
  const username = process.env.SUPERADMIN_USERNAME;
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error("SUPERADMIN_USERNAME and SUPERADMIN_PASSWORD must be set in .env");
  }

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    // Treat SUPERADMIN_USERNAME as the canonical bootstrap account name. If an
    // older superadmin exists under a previous username, rename that account
    // instead of creating a second bootstrap admin.
    const configuredUser = await prisma.user.findUnique({ where: { username } });
    const existingSuperadmin =
      configuredUser ??
      (await prisma.user.findFirst({
        where: { role: "SUPERADMIN" },
        orderBy: { createdAt: "asc" },
      }));

    const superadmin = existingSuperadmin
      ? await prisma.user.update({
          where: { id: existingSuperadmin.id },
          data: { username, passwordHash, role: "SUPERADMIN" },
        })
      : await prisma.user.create({
          data: { username, passwordHash, role: "SUPERADMIN" },
        });

    // Backfill: assign any election without an owner to the superadmin.
    // (No-op on a fresh DB; preserved for safety on future runs.)
    const orphans = await prisma.$executeRaw`
      UPDATE "elections" SET "ownerId" = ${superadmin.id} WHERE "ownerId" IS NULL
    `.catch(() => 0); // column is NOT NULL on fresh schema; ignore if no orphans

    console.log(`✓ Superadmin ready: ${superadmin.username} (${superadmin.id})`);
    console.log(`✓ Backfilled ${orphans} ownerless election(s)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
