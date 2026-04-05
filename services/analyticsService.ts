import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";

export type AnalyticsEventType =
  | "eligibility_check"
  | "scheme_view"
  | "scheme_click"
  | "scheme_share"
  | "scheme_search"
  | "seo_surface"
  | "conversion";

export async function recordAnalyticsEvent(eventType: AnalyticsEventType, meta?: Record<string, unknown>) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        eventType,
        meta: (meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (e) {
    console.error("[analytics] record failed", { eventType });
  }
}

export async function getDashboardSummary() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [checks24h, checks7d, engagements24h, byType] = await Promise.all([
    prisma.analyticsEvent.count({
      where: {
        eventType: "eligibility_check",
        createdAt: { gte: since24h },
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        eventType: "eligibility_check",
        createdAt: { gte: since7d },
      },
    }),
    prisma.schemeEngagement.count({ where: { createdAt: { gte: since24h } } }),
    prisma.analyticsEvent.groupBy({
      by: ["eventType"],
      _count: { id: true },
      where: { createdAt: { gte: since7d } },
    }),
  ]);

  const schemeCount = await prisma.scheme.count();

  return {
    generatedAt: new Date().toISOString(),
    schemesIndexed: schemeCount,
    eligibilityChecksLast24h: checks24h,
    eligibilityChecksLast7d: checks7d,
    engagementsLast24h: engagements24h,
    eventsByTypeLast7d: Object.fromEntries(byType.map((r) => [r.eventType, r._count.id])),
  };
}
