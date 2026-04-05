import type { Prisma } from "@prisma/client";

export type SchemeListInclude = Prisma.SchemeGetPayload<{
  include: {
    tags: { include: { tag: true } };
    benefitRows: true;
    documentRows: true;
    eligibilityRules: true;
  };
}>;

export type SchemeDetailInclude = Prisma.SchemeGetPayload<{
  include: {
    tags: { include: { tag: true } };
    eligibilityRules: true;
    benefitRows: true;
    documentRows: true;
    faqs: true;
  };
}>;

/** Public, SEO-friendly scheme shape (API contract). */
export type PublicScheme = {
  id: number;
  title: string;
  slug: string;
  description: string;
  benefits: Array<{ title?: string | null; body: string }>;
  documents: string[];
  eligibility_rules: unknown;
  state: string | null;
  district: string | null;
  category: string | null;
  tags: Array<{ slug: string; label: string }>;
  official_url: string;
  last_updated: string;
  ai_description?: string | null;
  ai_benefits_summary?: string | null;
  ai_faqs?: unknown;
  faqs?: Array<{ question: string; answer: string; sort: number }>;
};

function eligibilityRulesPayload(
  row: Pick<SchemeListInclude, "eligibility_rules_json" | "eligibilityRules">,
): unknown {
  if (row.eligibility_rules_json != null) return row.eligibility_rules_json;
  return row.eligibilityRules.map((r) => ({
    criterion: r.criterion,
    operator: r.operator,
    value: r.value,
    weight: r.weight,
  }));
}

function benefitsPayload(row: SchemeListInclude): PublicScheme["benefits"] {
  if (row.benefitRows.length > 0) {
    return row.benefitRows.map((b) => ({ title: b.title, body: b.body }));
  }
  return [{ body: row.benefit }];
}

function documentsPayload(row: SchemeListInclude): string[] {
  if (row.documentRows.length > 0) return row.documentRows.map((d) => d.name);
  return row.documents_required.split(/[;|]/).map((s) => s.trim()).filter(Boolean);
}

export function toPublicScheme(row: SchemeListInclude): PublicScheme {
  return {
    id: row.id,
    title: row.scheme_name,
    slug: row.slug,
    description: row.description,
    benefits: benefitsPayload(row),
    documents: documentsPayload(row),
    eligibility_rules: eligibilityRulesPayload(row),
    state: row.state,
    district: row.district ?? null,
    category: row.category ?? null,
    tags: row.tags.map((t) => ({ slug: t.tag.slug, label: t.tag.label })),
    official_url: row.apply_link,
    last_updated: row.updated_at.toISOString(),
    ai_description: row.ai_description,
    ai_benefits_summary: row.ai_benefits_summary,
    ai_faqs: row.ai_faqs ?? undefined,
  };
}

export function toPublicSchemeDetail(row: SchemeDetailInclude): PublicScheme {
  const base = toPublicScheme(row);
  return {
    ...base,
    faqs: row.faqs.map((f) => ({ question: f.question, answer: f.answer, sort: f.sort })),
  };
}
