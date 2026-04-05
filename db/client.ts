import { PrismaClient } from "@prisma/client";

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

/**
 * Cast to `PrismaClient` so TypeScript uses the full generated delegate surface
 * (`schemeFaq`, `seoBlogPost`, …). Without it, `new PrismaClient({ log })` can infer
 * a narrowed client type that omits models in some editor/TS setups.
 */
export const prisma = (globalForPrisma.prisma ?? createPrismaClient()) as PrismaClient;

globalForPrisma.prisma = prisma;
