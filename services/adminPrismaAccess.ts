import { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";

/**
 * Some TS language services infer a narrowed `PrismaClient` from `new PrismaClient({ log })`
 * and drop model delegates. Cast through generated delegate types for admin routes.
 */
type AdminPrisma = typeof prisma & {
  seoBlogPost: Prisma.SeoBlogPostDelegate;
  seoPage: Prisma.SeoPageDelegate;
  schemeFaq: Prisma.SchemeFaqDelegate;
};

export function adminDb(): AdminPrisma {
  return prisma as unknown as AdminPrisma;
}
