import { prisma } from "@/db/client";
import { cacheDel, cacheGetJson, cacheSetJson } from "@/utils/cache";
import type { TrendingRow } from "@/types/platform";

const CACHE_KEY = "platform:trending:v1";
const CACHE_TTL = 60;
const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_LIMIT = 20;

export async function computeTrendingSchemes(
  limit = DEFAULT_LIMIT,
  windowDays = DEFAULT_WINDOW_DAYS,
): Promise<TrendingRow[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const take = Math.min(Math.max(limit, 1), 50);

  const raw = await prisma.$queryRaw<
    { scheme_id: number; trendingScore: bigint | number }[]
  >`
    SELECT 
      e.scheme_id AS scheme_id,
      CAST(SUM(
        CASE e.type
          WHEN 'view' THEN 1
          WHEN 'click' THEN 2
          WHEN 'share' THEN 5
          ELSE 0
        END
      ) AS UNSIGNED) AS trendingScore
    FROM scheme_engagements e
    WHERE e.created_at >= ${since}
    GROUP BY e.scheme_id
    ORDER BY trendingScore DESC
    LIMIT ${take}
  `;

  if (raw.length === 0) {
    const fallback = await prisma.scheme.findMany({
      take,
      orderBy: { updated_at: "desc" },
      select: { id: true, slug: true, scheme_name: true },
    });
    return fallback.map((s) => ({
      schemeId: s.id,
      slug: s.slug,
      scheme_name: s.scheme_name,
      trendingScore: 0,
    }));
  }

  const ids = raw.map((r) => r.scheme_id);
  const schemes = await prisma.scheme.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, scheme_name: true },
  });
  const byId = new Map(schemes.map((s) => [s.id, s]));

  return raw
    .map((row) => {
      const s = byId.get(row.scheme_id);
      if (!s) return null;
      const ts = typeof row.trendingScore === "bigint" ? Number(row.trendingScore) : row.trendingScore;
      return {
        schemeId: s.id,
        slug: s.slug,
        scheme_name: s.scheme_name,
        trendingScore: ts,
      };
    })
    .filter((x): x is TrendingRow => x !== null);
}

export async function getTrendingCached(limit = DEFAULT_LIMIT): Promise<TrendingRow[]> {
  const key = `${CACHE_KEY}:${limit}`;
  const hit = await cacheGetJson<TrendingRow[]>(key);
  if (hit) return hit;
  const rows = await computeTrendingSchemes(limit);
  await cacheSetJson(key, rows, CACHE_TTL);
  return rows;
}

export async function invalidateTrendingCache() {
  for (const n of [10, 12, 15, 20, 50]) {
    await cacheDel(`${CACHE_KEY}:${n}`);
  }
}
