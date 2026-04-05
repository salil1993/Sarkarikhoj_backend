import type { EligibilityRule, Scheme, SchemeOnTag, Tag } from "@prisma/client";
import { prisma } from "@/db/client";
import { cacheGetJson, cacheSetJson } from "@/utils/cache";
import type { NormalizedEligibilityInput } from "@/types/eligibility";
import type { ScoredSchemeResult } from "@/types/platform";
import { isSchemeEligible } from "@/services/eligibilityEngine";

const CACHE_KEY = "platform:schemes:scoring:v1";
const CACHE_TTL = 120;

export type SchemeWithScoreDeps = Scheme & {
  tags: (SchemeOnTag & { tag: Tag })[];
  eligibilityRules: EligibilityRule[];
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
  rule: EligibilityRule,
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

  const schemeTagSlugs = new Set(scheme.tags.map((x) => x.tag.slug));
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

export async function loadSchemesForScoring(): Promise<SchemeWithScoreDeps[]> {
  const cached = await cacheGetJson<SchemeWithScoreDeps[]>(CACHE_KEY);
  if (cached) return cached;

  const rows = await prisma.scheme.findMany({
    include: {
      tags: { include: { tag: true } },
      eligibilityRules: true,
    },
    orderBy: { id: "asc" },
  });

  await cacheSetJson(CACHE_KEY, rows, CACHE_TTL);
  return rows;
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
      apply_link: scheme.apply_link,
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
