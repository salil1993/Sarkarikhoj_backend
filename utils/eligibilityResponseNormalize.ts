import type { ScoredSchemeResult } from "@/types/platform";

/** Safe for Prisma `Date`, ISO strings, or JSON-parsed cache values. */
export function toIsoDateString(d: unknown): string {
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString();
  if (typeof d === "string") {
    const x = new Date(d);
    if (!Number.isNaN(x.getTime())) return x.toISOString();
  }
  return new Date(0).toISOString();
}

/**
 * Ensures every field the web app expects is present (cached Redis payloads and old clients).
 */
export function normalizeScoredSchemeResult(raw: unknown): ScoredSchemeResult | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const schemeId = typeof r.schemeId === "number" ? r.schemeId : Number(r.schemeId);
  if (!Number.isFinite(schemeId) || schemeId <= 0) return null;

  const slug = String(r.slug ?? "").trim();
  if (!slug) return null;

  const scheme_name = String(r.scheme_name ?? r.title ?? "").trim() || slug;
  const title = String(r.title ?? r.scheme_name ?? "").trim() || scheme_name;
  const apply_link = String(r.apply_link ?? r.official_url ?? "").trim();
  const official_url = String(r.official_url ?? r.apply_link ?? "").trim() || apply_link;

  const eligibilityScoreRaw = r.eligibilityScore;
  const eligibilityScore =
    typeof eligibilityScoreRaw === "number" && Number.isFinite(eligibilityScoreRaw)
      ? eligibilityScoreRaw
      : Number(eligibilityScoreRaw);

  const matchedCriteria = Array.isArray(r.matchedCriteria)
    ? r.matchedCriteria.map((x) => String(x))
    : [];
  const missingCriteria = Array.isArray(r.missingCriteria)
    ? r.missingCriteria.map((x) => String(x))
    : [];

  return {
    schemeId,
    slug,
    scheme_name,
    title,
    apply_link,
    official_url,
    last_updated: typeof r.last_updated === "string" ? r.last_updated : toIsoDateString(r.last_updated),
    eligibilityScore: Number.isFinite(eligibilityScore) ? eligibilityScore : 0,
    matchedCriteria,
    missingCriteria,
  };
}

export function normalizeScoredResultsForClient(results: unknown[]): ScoredSchemeResult[] {
  const out: ScoredSchemeResult[] = [];
  for (const item of results) {
    const n = normalizeScoredSchemeResult(item);
    if (n) out.push(n);
  }
  return out;
}
