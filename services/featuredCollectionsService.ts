import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { toPublicScheme, type SchemeListInclude } from "@/services/schemePresenter";

const listInclude = {
  tags: { include: { tag: true } },
  benefitRows: { orderBy: { sort: "asc" as const } },
  documentRows: { orderBy: { sort: "asc" as const } },
  eligibilityRules: true,
} satisfies Prisma.SchemeInclude;

export async function listPublishedFeaturedCollections() {
  const cols = await prisma.featuredCollection.findMany({
    where: { published: true },
    orderBy: [{ sort: "asc" }, { id: "asc" }],
    include: {
      items: {
        where: { scheme: { publishStatus: "published" } },
        orderBy: { sort: "asc" },
        include: { scheme: { include: listInclude } },
      },
    },
  });

  return cols.map((c) => ({
    slug: c.slug,
    title: c.title,
    description: c.description,
    kind: c.kind,
    config: c.config,
    schemes: c.items.map((it) => toPublicScheme(it.scheme as SchemeListInclude)),
  }));
}

export async function listFeaturedCollectionsAdmin() {
  return prisma.featuredCollection.findMany({
    orderBy: [{ sort: "asc" }, { id: "asc" }],
    include: {
      items: { orderBy: { sort: "asc" }, select: { schemeId: true, sort: true } },
    },
  });
}

export async function createFeaturedCollection(data: {
  slug: string;
  title: string;
  description?: string | null;
  kind: string;
  config?: unknown;
  published?: boolean;
  sort?: number;
  schemeIds?: number[];
}) {
  const col = await prisma.featuredCollection.create({
    data: {
      slug: data.slug,
      title: data.title,
      description: data.description ?? null,
      kind: data.kind,
      config: (data.config ?? {}) as Prisma.InputJsonValue,
      published: data.published ?? false,
      sort: data.sort ?? 0,
    },
  });
  if (data.schemeIds?.length) {
    let i = 0;
    for (const schemeId of data.schemeIds) {
      await prisma.featuredCollectionItem.create({
        data: { collectionId: col.id, schemeId, sort: i++ },
      });
    }
  }
  return col;
}
