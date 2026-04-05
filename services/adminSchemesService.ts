import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { invalidateSchemeCache } from "@/services/eligibilityScoreEngine";
import { toPublicSchemeDetail, type SchemeDetailInclude } from "@/services/schemePresenter";
import { invalidateTrendingCache } from "@/services/trendingService";
import type { SchemeCreateInput, SchemeUpdateInput } from "@/utils/adminSchemas";
import { HttpError } from "@/utils/errors";

const detailInclude = {
  tags: { include: { tag: true } },
  eligibilityRules: true,
  benefitRows: { orderBy: { sort: "asc" as const } },
  documentRows: { orderBy: { sort: "asc" as const } },
  faqs: { orderBy: { sort: "asc" as const } },
} satisfies Prisma.SchemeInclude;

export type AdminSchemeDto = ReturnType<typeof toAdminSchemeDto>;

function toAdminSchemeDto(row: SchemeDetailInclude) {
  const p = toPublicSchemeDetail(row);
  return {
    id: p.id,
    scheme_name: row.scheme_name,
    title: p.title,
    slug: p.slug,
    description: p.description,
    min_age: row.min_age,
    max_age: row.max_age,
    income_limit: row.income_limit,
    gender: row.gender,
    occupation: row.occupation,
    state: row.state,
    district: row.district,
    category: row.category,
    benefit: row.benefit,
    documents_required: row.documents_required,
    apply_link: row.apply_link,
    official_url: row.apply_link,
    eligibility_rules_json: row.eligibility_rules_json,
    benefits: p.benefits,
    documents: p.documents,
    eligibility_rules: p.eligibility_rules,
    tags: p.tags,
    faqs: p.faqs,
    ai_description: p.ai_description,
    ai_benefits_summary: p.ai_benefits_summary,
    ai_faqs: p.ai_faqs,
    last_updated: p.last_updated,
  };
}

async function afterSchemeMutation() {
  void invalidateSchemeCache();
  void invalidateTrendingCache();
}

async function syncTags(schemeId: number, tagSlugs: string[] | undefined) {
  if (tagSlugs === undefined) return;
  await prisma.schemeOnTag.deleteMany({ where: { schemeId } });
  for (const tagSlug of tagSlugs) {
    const slug = tagSlug.trim().toLowerCase();
    if (!slug) continue;
    const tag = await prisma.tag.upsert({
      where: { slug },
      create: { slug, label: slug },
      update: {},
    });
    await prisma.schemeOnTag.create({ data: { schemeId, tagId: tag.id } });
  }
}

async function syncBenefits(
  schemeId: number,
  benefitText: string,
  rows: SchemeCreateInput["benefits"] | undefined,
) {
  await prisma.schemeBenefit.deleteMany({ where: { schemeId } });
  if (rows?.length) {
    let sort = 0;
    for (const b of rows) {
      await prisma.schemeBenefit.create({
        data: {
          schemeId,
          title: b.title ?? null,
          body: b.body,
          sort: b.sort ?? sort++,
        },
      });
    }
    return;
  }
  await prisma.schemeBenefit.create({
    data: { schemeId, body: benefitText, sort: 0 },
  });
}

async function syncDocuments(schemeId: number, docsText: string, rows: SchemeCreateInput["documents"]) {
  await prisma.documentRequirement.deleteMany({ where: { schemeId } });
  if (rows?.length) {
    let sort = 0;
    for (const d of rows) {
      await prisma.documentRequirement.create({
        data: { schemeId, name: d.name, sort: d.sort ?? sort++ },
      });
    }
    return;
  }
  const names = docsText
    .split(/[;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (let i = 0; i < names.length; i++) {
    await prisma.documentRequirement.create({ data: { schemeId, name: names[i], sort: i } });
  }
}

async function syncEligibilityRules(
  schemeId: number,
  rules: SchemeCreateInput["eligibilityRules"] | undefined,
) {
  if (rules === undefined) return;
  await prisma.eligibilityRule.deleteMany({ where: { schemeId } });
  for (const r of rules) {
    await prisma.eligibilityRule.create({
      data: {
        schemeId,
        criterion: r.criterion,
        operator: r.operator,
        value: r.value,
        weight: r.weight ?? 10,
      },
    });
  }
}

export async function listAdminSchemes(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [total, rows] = await Promise.all([
    prisma.scheme.count(),
    prisma.scheme.findMany({
      skip,
      take: limit,
      orderBy: { updated_at: "desc" },
      include: detailInclude,
    }),
  ]);
  return {
    schemes: rows.map((r) => toAdminSchemeDto(r as SchemeDetailInclude)),
    total,
    page,
    limit,
  };
}

export async function getAdminSchemeById(id: number) {
  const row = await prisma.scheme.findUnique({
    where: { id },
    include: detailInclude,
  });
  if (!row) return null;
  return toAdminSchemeDto(row as SchemeDetailInclude);
}

export async function createAdminScheme(data: SchemeCreateInput) {
  const benefitText =
    data.benefit?.trim() ||
    (data.benefits?.length ? data.benefits.map((b) => b.body).join("\n\n") : "");
  if (!benefitText) {
    throw new HttpError(400, "VALIDATION_ERROR", "benefit or benefits[] is required.");
  }
  const docsText = data.documents_required ?? "";
  const scheme = await prisma.scheme.create({
    data: {
      scheme_name: data.scheme_name,
      slug: data.slug,
      description: data.description,
      min_age: data.min_age ?? null,
      max_age: data.max_age ?? null,
      income_limit: data.income_limit ?? null,
      gender: data.gender ?? "any",
      occupation: data.occupation ?? "any",
      state: data.state ?? "any",
      district: data.district ?? null,
      category: data.category?.toLowerCase() ?? null,
      benefit: benefitText,
      documents_required: docsText,
      apply_link: data.apply_link,
      eligibility_rules_json:
        data.eligibility_rules_json === undefined
          ? undefined
          : (data.eligibility_rules_json as Prisma.InputJsonValue),
    },
  });

  await syncBenefits(scheme.id, benefitText, data.benefits);
  await syncDocuments(scheme.id, docsText || "", data.documents);
  await syncEligibilityRules(scheme.id, data.eligibilityRules);
  await syncTags(scheme.id, data.tagSlugs);

  await afterSchemeMutation();

  const full = await prisma.scheme.findUniqueOrThrow({
    where: { id: scheme.id },
    include: detailInclude,
  });
  return toAdminSchemeDto(full as SchemeDetailInclude);
}

export async function updateAdminScheme(id: number, data: SchemeUpdateInput) {
  const existing = await prisma.scheme.findUnique({ where: { id } });
  if (!existing) return null;

  const nextBenefitText = data.benefit ?? existing.benefit;
  const nextDocsText = data.documents_required ?? existing.documents_required;

  const updated = await prisma.scheme.update({
    where: { id },
    data: {
      ...(data.scheme_name !== undefined ? { scheme_name: data.scheme_name } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.min_age !== undefined ? { min_age: data.min_age } : {}),
      ...(data.max_age !== undefined ? { max_age: data.max_age } : {}),
      ...(data.income_limit !== undefined ? { income_limit: data.income_limit } : {}),
      ...(data.gender !== undefined ? { gender: data.gender } : {}),
      ...(data.occupation !== undefined ? { occupation: data.occupation } : {}),
      ...(data.state !== undefined ? { state: data.state } : {}),
      ...(data.district !== undefined ? { district: data.district } : {}),
      ...(data.category !== undefined ? { category: data.category?.toLowerCase() ?? null } : {}),
      ...(data.benefit !== undefined ? { benefit: data.benefit } : {}),
      ...(data.documents_required !== undefined ? { documents_required: data.documents_required } : {}),
      ...(data.apply_link !== undefined ? { apply_link: data.apply_link } : {}),
      ...(data.eligibility_rules_json !== undefined
        ? { eligibility_rules_json: data.eligibility_rules_json as Prisma.InputJsonValue }
        : {}),
    },
  });

  if (data.benefits !== undefined) {
    const joined =
      data.benefits.length > 0 ? data.benefits.map((b) => b.body).join("\n\n") : existing.benefit;
    await syncBenefits(updated.id, joined, data.benefits.length > 0 ? data.benefits : undefined);
    await prisma.scheme.update({ where: { id: updated.id }, data: { benefit: joined } });
  } else if (data.benefit !== undefined) {
    await syncBenefits(updated.id, nextBenefitText, undefined);
  }
  if (data.documents !== undefined) {
    const text =
      data.documents.length > 0
        ? data.documents.map((d) => d.name).join("; ")
        : existing.documents_required;
    await syncDocuments(
      updated.id,
      text,
      data.documents.length > 0 ? data.documents : undefined,
    );
    await prisma.scheme.update({ where: { id: updated.id }, data: { documents_required: text } });
  } else if (data.documents_required !== undefined) {
    await syncDocuments(updated.id, nextDocsText, undefined);
  }
  if (data.eligibilityRules !== undefined) {
    await syncEligibilityRules(updated.id, data.eligibilityRules);
  }
  if (data.tagSlugs !== undefined) {
    await syncTags(updated.id, data.tagSlugs);
  }

  await afterSchemeMutation();

  const full = await prisma.scheme.findUniqueOrThrow({
    where: { id: updated.id },
    include: detailInclude,
  });
  return toAdminSchemeDto(full as SchemeDetailInclude);
}

export async function deleteAdminScheme(id: number) {
  const r = await prisma.scheme.deleteMany({ where: { id } });
  if (r.count === 0) return false;
  await afterSchemeMutation();
  return true;
}
