import { prisma } from "@/db/client";
import type { ScoredSchemeResult } from "@/types/platform";

export async function notifyHighMatch(
  userId: number,
  top: ScoredSchemeResult[],
  threshold = 85,
) {
  const hot = top.filter((r) => r.eligibilityScore >= threshold);
  if (hot.length === 0) return;
  await prisma.notification.create({
    data: {
      userId,
      type: "high_eligibility_match",
      payload: {
        schemes: hot.slice(0, 5).map((h) => ({
          schemeId: h.schemeId,
          slug: h.slug,
          score: h.eligibilityScore,
        })),
      },
    },
  });
}

export async function notifyTrending(userId: number, schemeIds: number[]) {
  if (schemeIds.length === 0) return;
  await prisma.notification.create({
    data: {
      userId,
      type: "trending_near_you",
      payload: { schemeIds: schemeIds.slice(0, 10) },
    },
  });
}
