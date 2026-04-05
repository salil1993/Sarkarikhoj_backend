import type { Prisma } from "@prisma/client";
import { cacheGetJson, cacheSetJson } from "@/utils/cache";
import { prisma } from "@/db/client";
import { toPublicScheme, type PublicScheme, type SchemeListInclude } from "@/services/schemePresenter";

const CACHE_TTL_SEC = 300;
const CACHE_PREFIX = "platform:seo:surface:v1";

const listInclude = {
  tags: { include: { tag: true } },
  benefitRows: { orderBy: { sort: "asc" as const } },
  documentRows: { orderBy: { sort: "asc" as const } },
  eligibilityRules: true,
} satisfies Prisma.SchemeInclude;

export type SeoSurfaceType = "category" | "location" | "income";

export type SeoSurfacePayload = {
  type: SeoSurfaceType;
  title: string;
  description: string;
  canonical_query: Record<string, string>;
  schemes: PublicScheme[];
  scheme_count: number;
};

function cacheKey(type: SeoSurfaceType, q: Record<string, string>): string {
  const stable = JSON.stringify(Object.keys(q).sort().map((k) => [k, q[k]]));
  return `${CACHE_PREFIX}:${type}:${stable}`;
}

async function rowsToPublic(where: Prisma.SchemeWhereInput): Promise<PublicScheme[]> {
  const rows = await prisma.scheme.findMany({
    where: { AND: [{ publishStatus: "published" }, where] },
    include: listInclude,
    orderBy: { updated_at: "desc" },
    take: 80,
  });
  return rows.map((r) => toPublicScheme(r as SchemeListInclude));
}

export async function getSeoSurface(
  type: SeoSurfaceType,
  query: URLSearchParams,
): Promise<SeoSurfacePayload | null> {
  const canonical: Record<string, string> = {};

  if (type === "category") {
    const slug = query.get("slug")?.trim().toLowerCase() || query.get("category")?.trim().toLowerCase();
    if (!slug) return null;
    canonical.category = slug;
    const ck = cacheKey(type, canonical);
    const hit = await cacheGetJson<SeoSurfacePayload>(ck);
    if (hit) return hit;

    const where: Prisma.SchemeWhereInput = {
      OR: [{ category: slug }, { tags: { some: { tag: { slug } } } }],
    };
    const schemes = await rowsToPublic(where);
    const payload: SeoSurfacePayload = {
      type,
      title: `Government schemes — ${slug.replace(/-/g, " ")}`,
      description: `Informational listing of schemes tagged or categorised as “${slug}”. Not legal or official advice; confirm on official portals.`,
      canonical_query: canonical,
      schemes,
      scheme_count: schemes.length,
    };
    await cacheSetJson(ck, payload, CACHE_TTL_SEC);
    return payload;
  }

  if (type === "location") {
    const state = query.get("state")?.trim().toLowerCase();
    if (!state) return null;
    canonical.state = state;
    const district = query.get("district")?.trim().toLowerCase();
    if (district) canonical.district = district;

    const ck = cacheKey(type, canonical);
    const hit = await cacheGetJson<SeoSurfacePayload>(ck);
    if (hit) return hit;

    const clauses: Prisma.SchemeWhereInput[] = [
      {
        OR: [{ state: null }, { state: "any" }, { state }],
      },
    ];
    if (district) {
      clauses.push({
        OR: [
          { district: null },
          { district: "any" },
          { district: "" },
          { district },
        ],
      });
    }

    const schemes = await rowsToPublic({ AND: clauses });
    const loc = district ? `${district}, ${state}` : state;
    const payload: SeoSurfacePayload = {
      type,
      title: `Government schemes for ${loc}`,
      description: `Schemes that may apply in or cover ${loc}. Informational only; eligibility rules vary — verify on official_url for each scheme.`,
      canonical_query: canonical,
      schemes,
      scheme_count: schemes.length,
    };
    await cacheSetJson(ck, payload, CACHE_TTL_SEC);
    return payload;
  }

  if (type === "income") {
    const maxRaw = query.get("max_income") ?? query.get("income_max");
    const maxIncome = maxRaw ? parseInt(maxRaw, 10) : NaN;
    if (!Number.isFinite(maxIncome) || maxIncome < 0) return null;
    canonical.max_income = String(maxIncome);

    const ck = cacheKey(type, canonical);
    const hit = await cacheGetJson<SeoSurfacePayload>(ck);
    if (hit) return hit;

    const schemes = await rowsToPublic({
      OR: [{ income_limit: null }, { income_limit: { gte: maxIncome } }],
    });
    const top = schemes.slice(0, 60);
    const payload: SeoSurfacePayload = {
      type,
      title: `Schemes with income criteria around ₹${maxIncome.toLocaleString("en-IN")}`,
      description:
        "Listing filtered where the scheme has no income ceiling or allows annual income up to at least this amount (per our data). Informational only; verify on official_url.",
      canonical_query: canonical,
      schemes: top,
      scheme_count: top.length,
    };
    await cacheSetJson(ck, payload, CACHE_TTL_SEC);
    return payload;
  }

  return null;
}
