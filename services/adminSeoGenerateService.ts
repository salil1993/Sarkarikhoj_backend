import type { Prisma } from "@prisma/client";
import { adminDb } from "@/services/adminPrismaAccess";
import { getSeoSurface } from "@/services/seoSurfaceService";
import type { SeoGenerateInput } from "@/utils/adminSchemas";

function slugPart(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function pageSlug(page: SeoGenerateInput["pages"][number]): string {
  if (page.kind === "category") return `cat-${slugPart(page.slug)}`;
  if (page.kind === "location") {
    const d = page.district ? slugPart(page.district) : "all";
    return `loc-${slugPart(page.state)}-${d}`;
  }
  return `inc-${page.max_income}`;
}

export async function generateAndStoreSeoPages(input: SeoGenerateInput) {
  const stored: Array<{
    id: number;
    slug: string;
    type: string;
    title: string;
    scheme_count: number;
  }> = [];

  for (const page of input.pages) {
    const sp = new URLSearchParams();
    if (page.kind === "category") {
      sp.set("slug", page.slug.trim().toLowerCase());
    } else if (page.kind === "location") {
      sp.set("state", page.state.trim().toLowerCase());
      if (page.district?.trim()) sp.set("district", page.district.trim().toLowerCase());
    } else {
      sp.set("max_income", String(page.max_income));
    }

    const surface = await getSeoSurface(page.kind, sp);
    if (!surface) continue;

    const slug = pageSlug(page);
    const row = await adminDb().seoPage.upsert({
      where: { slug },
      create: {
        type: surface.type,
        slug,
        title: surface.title,
        description: surface.description,
        payload: surface as unknown as Prisma.InputJsonValue,
        published: input.published ?? false,
      },
      update: {
        type: surface.type,
        title: surface.title,
        description: surface.description,
        payload: surface as unknown as Prisma.InputJsonValue,
        ...(input.published !== undefined ? { published: input.published } : {}),
      },
    });

    stored.push({
      id: row.id,
      slug: row.slug,
      type: row.type,
      title: row.title,
      scheme_count: surface.scheme_count,
    });
  }

  return { pages: stored, count: stored.length };
}
