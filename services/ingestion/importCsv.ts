import { prisma } from "@/db/client";
import { invalidateSchemeCache } from "@/services/eligibilityScoreEngine";

export type CsvRow = Record<string, string>;

function splitDocs(raw: string): string[] {
  return raw
    .split(/[;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Expects header row: scheme_name,slug,description,min_age,max_age,income_limit,gender,occupation,state,benefit,documents_required,apply_link,tags (optional comma-separated slugs)
 */
export async function importSchemesFromCsvRows(rows: CsvRow[]): Promise<{ upserted: number; errors: string[] }> {
  const errors: string[] = [];
  let upserted = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      const slug = r.slug?.trim();
      if (!slug) {
        errors.push(`row ${i + 1}: missing slug`);
        continue;
      }

      const scheme = await prisma.scheme.upsert({
        where: { slug },
        create: {
          scheme_name: r.scheme_name?.trim() || slug,
          slug,
          description: r.description?.trim() || "",
          min_age: r.min_age ? parseInt(r.min_age, 10) : null,
          max_age: r.max_age ? parseInt(r.max_age, 10) : null,
          income_limit: r.income_limit ? parseInt(r.income_limit, 10) : null,
          gender: r.gender?.trim() || "any",
          occupation: r.occupation?.trim() || "any",
          state: r.state?.trim() || "any",
          benefit: r.benefit?.trim() || "",
          documents_required: r.documents_required?.trim() || "",
          apply_link: r.apply_link?.trim() || "https://india.gov.in/",
        },
        update: {
          scheme_name: r.scheme_name?.trim() || slug,
          description: r.description?.trim() || "",
          min_age: r.min_age ? parseInt(r.min_age, 10) : null,
          max_age: r.max_age ? parseInt(r.max_age, 10) : null,
          income_limit: r.income_limit ? parseInt(r.income_limit, 10) : null,
          gender: r.gender?.trim() || "any",
          occupation: r.occupation?.trim() || "any",
          state: r.state?.trim() || "any",
          benefit: r.benefit?.trim() || "",
          documents_required: r.documents_required?.trim() || "",
          apply_link: r.apply_link?.trim() || "https://india.gov.in/",
        },
      });

      await prisma.documentRequirement.deleteMany({ where: { schemeId: scheme.id } });
      const docNames = splitDocs(scheme.documents_required);
      for (let j = 0; j < docNames.length; j++) {
        await prisma.documentRequirement.create({
          data: { schemeId: scheme.id, name: docNames[j], sort: j },
        });
      }

      if (r.tags?.trim()) {
        const slugs = r.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
        for (const tagSlug of slugs) {
          const tag = await prisma.tag.upsert({
            where: { slug: tagSlug },
            create: { slug: tagSlug, label: tagSlug },
            update: {},
          });
          await prisma.schemeOnTag.upsert({
            where: { schemeId_tagId: { schemeId: scheme.id, tagId: tag.id } },
            create: { schemeId: scheme.id, tagId: tag.id },
            update: {},
          });
        }
      }

      upserted += 1;
    } catch (e) {
      errors.push(`row ${i + 1}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  await invalidateSchemeCache();
  return { upserted, errors };
}

export function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const row: CsvRow = {};
    headers.forEach((h, j) => {
      row[h] = (cols[j] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}
