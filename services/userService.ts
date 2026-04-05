import { prisma } from "@/db/client";

export async function ensureUserByExternalId(externalId: string) {
  return prisma.user.upsert({
    where: { externalId },
    create: { externalId },
    update: {},
  });
}
