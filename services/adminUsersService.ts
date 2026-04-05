import { prisma } from "@/db/client";

export async function listAdminUsers(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [total, rows] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        externalId: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        _count: {
          select: {
            savedSchemes: true,
            engagements: true,
            checks: true,
          },
        },
      },
    }),
  ]);

  return {
    users: rows.map((u) => ({
      id: u.id,
      externalId: u.externalId,
      email: u.email,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      profile: u.profile,
      counts: {
        savedSchemes: u._count.savedSchemes,
        engagements: u._count.engagements,
        eligibilityChecks: u._count.checks,
      },
    })),
    total,
    page,
    limit,
  };
}

export async function getAdminUserById(id: number) {
  const u = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          savedSchemes: true,
          engagements: true,
          checks: true,
          notifications: true,
        },
      },
    },
  });
  if (!u) return null;

  const { _count, ...rest } = u;
  return {
    id: rest.id,
    externalId: rest.externalId,
    email: rest.email,
    profile: rest.profile,
    createdAt: rest.createdAt.toISOString(),
    updatedAt: rest.updatedAt.toISOString(),
    counts: {
      savedSchemes: _count.savedSchemes,
      engagements: _count.engagements,
      eligibilityChecks: _count.checks,
      notifications: _count.notifications,
    },
  };
}
