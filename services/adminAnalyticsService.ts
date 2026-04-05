import { prisma } from "@/db/client";
import { getTrendingCached } from "@/services/trendingService";
import type { TrendingRow } from "@/types/platform";
import { cacheGetJson, cacheSetJson } from "@/utils/cache";

const CACHE_KEY = "platform:admin:analytics:v1";
const CACHE_TTL_SEC = 60;

export type AdminAnalyticsBundle = {
  generatedAt: string;
  totalUsers: number;
  totalSchemes: number;
  trendingSchemes: TrendingRow[];
  topSearches: Array<{ queryPrefix: string; count: number }>;
};

export async function getAdminAnalyticsCached(): Promise<AdminAnalyticsBundle> {
  const hit = await cacheGetJson<AdminAnalyticsBundle>(CACHE_KEY);
  if (hit) return hit;

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalUsers, totalSchemes, trendingSchemes, topRaw] = await Promise.all([
    prisma.user.count(),
    prisma.scheme.count(),
    getTrendingCached(15),
    prisma.$queryRaw<Array<{ q: string | null; c: bigint | number }>>`
      SELECT JSON_UNQUOTE(JSON_EXTRACT(meta, '$.queryPrefix')) AS q, COUNT(*) AS c
      FROM analytics_events
      WHERE event_type = 'scheme_search'
        AND created_at >= ${since7d}
        AND meta IS NOT NULL
        AND JSON_EXTRACT(meta, '$.queryPrefix') IS NOT NULL
      GROUP BY q
      ORDER BY c DESC
      LIMIT 25
    `,
  ]);

  const topSearches = topRaw
    .filter((r): r is { q: string; c: bigint | number } => Boolean(r.q && String(r.q).length > 0))
    .map((r) => ({
      queryPrefix: String(r.q),
      count: typeof r.c === "bigint" ? Number(r.c) : r.c,
    }));

  const bundle: AdminAnalyticsBundle = {
    generatedAt: new Date().toISOString(),
    totalUsers,
    totalSchemes,
    trendingSchemes,
    topSearches,
  };

  await cacheSetJson(CACHE_KEY, bundle, CACHE_TTL_SEC);
  return bundle;
}
