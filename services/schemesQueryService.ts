import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { getTrendingCached } from "@/services/trendingService";
import { toPublicScheme, type PublicScheme, type SchemeListInclude } from "@/services/schemePresenter";

const listInclude = {
  tags: { include: { tag: true } },
  benefitRows: { orderBy: { sort: "asc" as const } },
  documentRows: { orderBy: { sort: "asc" as const } },
  eligibilityRules: true,
} satisfies Prisma.SchemeInclude;

export type ListSchemesParams = {
  state?: string;
  district?: string;
  category?: string;
  sort?: string;
  q?: string;
};

export async function listPublicSchemes(params: ListSchemesParams): Promise<PublicScheme[]> {
  const clauses: Prisma.SchemeWhereInput[] = [];

  if (params.state) {
    const s = params.state;
    clauses.push({
      OR: [{ state: null }, { state: "any" }, { state: s }],
    });
  }

  if (params.district) {
    const d = params.district;
    clauses.push({
      OR: [
        { district: null },
        { district: "any" },
        { district: "" },
        { district: d },
      ],
    });
  }

  if (params.category) {
    const c = params.category;
    clauses.push({
      OR: [{ category: c }, { tags: { some: { tag: { slug: c } } } }],
    });
  }

  if (params.q) {
    const q = params.q;
    clauses.push({
      OR: [
        { scheme_name: { contains: q } },
        { description: { contains: q } },
        { slug: { contains: q } },
      ],
    });
  }

  const where: Prisma.SchemeWhereInput = clauses.length > 0 ? { AND: clauses } : {};

  const rows = await prisma.scheme.findMany({
    where: clauses.length > 0 ? where : undefined,
    include: listInclude,
    orderBy: { scheme_name: "asc" },
  });

  const publicRows = rows.map((r) => toPublicScheme(r as SchemeListInclude));

  if (params.sort === "trending") {
    const trending = await getTrendingCached(100);
    const order = new Map(trending.map((t, i) => [t.schemeId, i]));
    publicRows.sort((a, b) => {
      const ra = order.has(a.id) ? order.get(a.id)! : 9999;
      const rb = order.has(b.id) ? order.get(b.id)! : 9999;
      if (ra !== rb) return ra - rb;
      return a.title.localeCompare(b.title);
    });
  }

  return publicRows;
}
