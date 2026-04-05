import { Prisma, type Scheme } from "@prisma/client";
import { prisma } from "@/db/client";
import { cacheGetJson, cacheSetJson } from "@/utils/cache";
import type { NormalizedEligibilityInput } from "@/types/eligibility";
import type { ScoredSchemeResult } from "@/types/platform";
import { isSchemeEligible } from "@/services/eligibilityEngine";

/** Bump when cache shape changes (avoids stale/corrupt Redis breaking scoring). */
const CACHE_KEY = "platform:schemes:scoring:v2";
const CACHE_TTL = 120;

/**
 * Shape returned by `findMany` with tags + rules (matches Prisma schema; explicit so editors
 * that mis-resolve `@prisma/client` still type-check).
 */
export type SchemeWithScoreDeps = Scheme & {
  tags: Array<{
    schemeId: number;
    tagId: number;
    tag: { id: number; slug: string; label: string };
  }>;
  eligibilityRules: Array<{
    id: number;
    schemeId: number;
    criterion: string;
    operator: string;
    value: string;
    weight: number;
  }>;
};

type EligibilityRuleRow = SchemeWithScoreDeps["eligibilityRules"][number];
type SchemeTagRow = SchemeWithScoreDeps["tags"][number];

const scoringFindManyArgs = {
  include: {
    tags: { include: { tag: true } },
    eligibilityRules: true,
  },
  orderBy: { id: "asc" as const },
};

function fieldWildcardMatch(
  schemeVal: string | null | undefined,
  userVal: string,
): { ok: boolean; label: string } {
  if (schemeVal == null) return { ok: true, label: "location/state (open)" };
  const s = schemeVal.trim().toLowerCase();
  if (s === "" || s === "any") return { ok: true, label: "open criteria" };
  const ok = s === userVal.trim().toLowerCase();
  return {
    ok,
    label: ok ? `matches ${schemeVal}` : `needs ${schemeVal} (you: ${userVal})`,
  };
}

function parseRuleValue(raw: string): unknown {
  const t = raw.trim();
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return raw;
    }
  }
  if (/^-?\d+$/.test(t)) return Number(t);
  return raw;
}

function evaluateDbRule(
  rule: EligibilityRuleRow,
  criteria: NormalizedEligibilityInput,
  userTags: Set<string>,
): { earned: number; matched?: string; missed?: string } {
  const w = rule.weight;
  const val = parseRuleValue(rule.value);

  switch (rule.criterion) {
    case "age_gte":
      if (typeof val !== "number") return { earned: 0, missed: "age rule invalid" };
      if (criteria.age >= val) return { earned: w, matched: `age ≥ ${val}` };
      return { earned: 0, missed: `age must be ≥ ${val}` };
    case "age_lte":
      if (typeof val !== "number") return { earned: 0, missed: "age rule invalid" };
      if (criteria.age <= val) return { earned: w, matched: `age ≤ ${val}` };
      return { earned: 0, missed: `age must be ≤ ${val}` };
    case "income_lte":
      if (typeof val !== "number") return { earned: 0, missed: "income rule invalid" };
      if (criteria.income <= val) return { earned: w, matched: `income ≤ ₹${val}` };
      return { earned: 0, missed: `income must be ≤ ₹${val}` };
    case "gender_eq": {
      const need = String(val).toLowerCase();
      if (need === "any") return { earned: w, matched: "gender (open)" };
      if (criteria.gender === need) return { earned: w, matched: `gender: ${need}` };
      return { earned: 0, missed: `gender must be ${need}` };
    }
    case "occupation_eq": {
      const need = String(val).toLowerCase();
      if (need === "any") return { earned: w, matched: "occupation (open)" };
      if (criteria.occupation === need) return { earned: w, matched: `occupation: ${need}` };
      return { earned: 0, missed: `occupation must be ${need}` };
    }
    case "state_eq": {
      const need = String(val).toLowerCase();
      if (need === "any") return { earned: w, matched: "state (national)" };
      if (criteria.state === need) return { earned: w, matched: `state: ${need}` };
      return { earned: 0, missed: `state must be ${need}` };
    }
    case "tag_any": {
      const needTags = Array.isArray(val) ? val.map(String) : [String(val)];
      const hit = needTags.some((t) => userTags.has(t.toLowerCase()));
      if (hit) return { earned: w, matched: `tag: ${needTags.join("/")}` };
      return { earned: 0, missed: `needs one of tags: ${needTags.join(", ")}` };
    }
    default:
      return { earned: 0, missed: `unknown rule ${rule.criterion}` };
  }
}

function scoreFromDbRules(
  scheme: SchemeWithScoreDeps,
  criteria: NormalizedEligibilityInput,
  userTags: Set<string>,
): { score: number; matched: string[]; missing: string[] } {
  const rules = scheme.eligibilityRules;
  if (rules.length === 0) {
    return scoreFromLegacy(scheme, criteria, userTags);
  }
  let earned = 0;
  let possible = 0;
  const matched: string[] = [];
  const missing: string[] = [];
  for (const r of rules) {
    possible += r.weight;
    const out = evaluateDbRule(r, criteria, userTags);
    earned += out.earned;
    if (out.matched) matched.push(out.matched);
    if (out.missed) missing.push(out.missed);
  }
  const score = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  return { score, matched, missing };
}

function scoreFromLegacy(
  scheme: SchemeWithScoreDeps,
  criteria: NormalizedEligibilityInput,
  userTags: Set<string>,
): { score: number; matched: string[]; missing: string[] } {
  const matched: string[] = [];
  const missing: string[] = [];
  let pts = 0;
  let max = 0;

  const add = (ok: boolean, m: string, miss: string) => {
    max += 1;
    if (ok) {
      pts += 1;
      matched.push(m);
    } else {
      missing.push(miss);
    }
  };

  if (scheme.min_age != null) {
    add(criteria.age >= scheme.min_age, `age ≥ ${scheme.min_age}`, `age ≥ ${scheme.min_age}`);
  }
  if (scheme.max_age != null) {
    add(criteria.age <= scheme.max_age, `age ≤ ${scheme.max_age}`, `age ≤ ${scheme.max_age}`);
  }
  if (scheme.income_limit != null) {
    add(
      criteria.income <= scheme.income_limit,
      `income ≤ ₹${scheme.income_limit}`,
      `income ≤ ₹${scheme.income_limit}`,
    );
  } else {
    max += 1;
    pts += 1;
    matched.push("no income ceiling");
  }

  const g = fieldWildcardMatch(scheme.gender, criteria.gender);
  add(g.ok, g.label, g.label);
  const o = fieldWildcardMatch(scheme.occupation, criteria.occupation);
  add(o.ok, o.label, o.label);
  const st = fieldWildcardMatch(scheme.state, criteria.state);
  add(st.ok, st.label, st.label);

  const schemeTagSlugs = new Set<string>(
    scheme.tags.map((x: SchemeTagRow) => x.tag.slug),
  );
  if (schemeTagSlugs.size > 0) {
    max += 1;
    const overlap = [...schemeTagSlugs].some((t) => userTags.has(t));
    if (overlap) {
      pts += 1;
      matched.push(`tag overlap: ${[...schemeTagSlugs].join(", ")}`);
    } else {
      missing.push(`audience tags: ${[...schemeTagSlugs].join(", ")}`);
    }
  }

  const score = max > 0 ? Math.round((pts / max) * 100) : 100;
  return { score, matched, missing };
}

export function inferUserTags(
  criteria: NormalizedEligibilityInput,
  extra: string[],
): Set<string> {
  const s = new Set(extra.map((t) => t.toLowerCase().trim()).filter(Boolean));
  if (criteria.occupation === "student") s.add("student");
  if (criteria.occupation === "farmer") s.add("farmer");
  if (criteria.gender === "female") s.add("women");
  if (criteria.age >= 60) s.add("senior_citizen");
  const c = (criteria.category || "").toLowerCase();
  if (c.includes("general")) s.add("general");
  if (c.includes("obc")) s.add("obc");
  if (c.includes("sc") || c.includes("scheduled")) s.add("sc");
  if (c.includes("st") || c.includes("tribe")) s.add("st");
  return s;
}

function schemesAsLegacyOnly(rows: Scheme[]): SchemeWithScoreDeps[] {
  return rows.map((s) => ({
    ...s,
    tags: [],
    eligibilityRules: [],
  })) as SchemeWithScoreDeps[];
}

function isDbConnectionError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientInitializationError) return true;
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return e.code === "P1001" || e.code === "P1002" || e.code === "P1017";
  }
  return false;
}

function isLikelyMissingPlatformSchemaError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return (
      e.code === "P2021" ||
      e.code === "P2022" ||
      e.code === "P2010" ||
      e.code === "P2023"
    );
  }
  if (e instanceof Prisma.PrismaClientUnknownRequestError) {
    const m = e.message.toLowerCase();
    return (
      m.includes("doesn't exist") ||
      m.includes("does not exist") ||
      m.includes("er_no_such_table") ||
      m.includes("er_bad_field_error") ||
      m.includes("1146") ||
      m.includes("1054")
    );
  }
  return false;
}

function isValidScoringCache(data: unknown): data is SchemeWithScoreDeps[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  for (const row of data) {
    if (row === null || typeof row !== "object") return false;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "number") return false;
    if (!Array.isArray(r.tags) || !Array.isArray(r.eligibilityRules)) return false;
  }
  return true;
}

/**
 * Loads schemes for scoring. Uses tags + eligibility_rules when present.
 * If platform migrations are missing on the DB (common when only `schemes` exists),
 * falls back to legacy columns only so `/api/check-eligibility` still works.
 */
async function loadSchemesLegacyFromDb(): Promise<SchemeWithScoreDeps[]> {
  const rows = await prisma.scheme.findMany({ orderBy: { id: "asc" } });
  return schemesAsLegacyOnly(rows);
}

export async function loadSchemesForScoring(): Promise<SchemeWithScoreDeps[]> {
  let cached: unknown = null;
  try {
    cached = await cacheGetJson(CACHE_KEY);
  } catch {
    cached = null;
  }
  if (isValidScoringCache(cached)) return cached;

  try {
    const rows = (await prisma.scheme.findMany(
      scoringFindManyArgs as unknown as Parameters<typeof prisma.scheme.findMany>[0],
    )) as SchemeWithScoreDeps[];
    try {
      await cacheSetJson(CACHE_KEY, rows, CACHE_TTL);
    } catch {
      /* cache optional */
    }
    return rows;
  } catch (e) {
    if (isDbConnectionError(e)) throw e;

    const useLegacy =
      isLikelyMissingPlatformSchemaError(e) ||
      e instanceof Prisma.PrismaClientValidationError;
    if (!useLegacy) {
      console.error("[eligibility] full scheme load failed", {
        name: e instanceof Error ? e.name : "unknown",
        code: e instanceof Prisma.PrismaClientKnownRequestError ? e.code : undefined,
      });
    }

    try {
      const legacy = await loadSchemesLegacyFromDb();
      console.warn("[eligibility] using legacy scheme load (relations unavailable or cache skipped)", {
        reason: useLegacy ? "schema_or_validation" : "unknown_prisma_error",
        prismaCode:
          e instanceof Prisma.PrismaClientKnownRequestError ? e.code : undefined,
      });
      try {
        await cacheSetJson(CACHE_KEY, legacy, CACHE_TTL);
      } catch {
        /* cache optional */
      }
      return legacy;
    } catch {
      throw e;
    }
  }
}

/** Cached scheme rows are JSON; `updated_at` is often an ISO string, not a `Date`. */
function lastUpdatedIso(s: SchemeWithScoreDeps): string {
  const u = s.updated_at as unknown;
  if (u instanceof Date && !Number.isNaN(u.getTime())) return u.toISOString();
  if (typeof u === "string") {
    const d = new Date(u);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

export function scoreSchemes(
  schemes: SchemeWithScoreDeps[],
  criteria: NormalizedEligibilityInput,
  userTags: Set<string>,
  mode: "strict" | "scored",
  limit: number,
): ScoredSchemeResult[] {
  const out: ScoredSchemeResult[] = [];

  for (const scheme of schemes) {
    if (mode === "strict" && !isSchemeEligible(scheme, criteria)) {
      continue;
    }

    const hasRules = scheme.eligibilityRules.length > 0;
    const { score, matched, missing } = hasRules
      ? scoreFromDbRules(scheme, criteria, userTags)
      : scoreFromLegacy(scheme, criteria, userTags);

    out.push({
      schemeId: scheme.id,
      slug: scheme.slug,
      scheme_name: scheme.scheme_name,
      title: scheme.scheme_name,
      apply_link: scheme.apply_link,
      official_url: scheme.apply_link,
      last_updated: lastUpdatedIso(scheme),
      eligibilityScore: score,
      matchedCriteria: matched,
      missingCriteria: missing,
    });
  }

  if (mode === "strict") {
    return out.slice(0, limit);
  }

  out.sort((a, b) => b.eligibilityScore - a.eligibilityScore);
  return out.slice(0, limit);
}

export async function invalidateSchemeCache() {
  const { cacheDel } = await import("@/utils/cache");
  await cacheDel(CACHE_KEY);
}
