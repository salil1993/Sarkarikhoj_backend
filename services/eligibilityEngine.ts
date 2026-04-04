import type { Prisma, Scheme } from "@prisma/client";
import { prisma } from "@/db/client";
import type { NormalizedEligibilityInput } from "@/types/eligibility";

function fieldMatchesWildcard(
  schemeValue: string | null | undefined,
  userValue: string,
): boolean {
  if (schemeValue == null) return true;
  const s = schemeValue.trim().toLowerCase();
  if (s === "" || s === "any") return true;
  return s === userValue.trim().toLowerCase();
}

/**
 * Pure eligibility check for a single scheme (unit-test friendly).
 */
export function isSchemeEligible(scheme: Scheme, criteria: NormalizedEligibilityInput): boolean {
  const { age, gender, state, income, occupation } = criteria;

  if (scheme.min_age != null && age < scheme.min_age) return false;
  if (scheme.max_age != null && age > scheme.max_age) return false;
  if (scheme.income_limit != null && income > scheme.income_limit) return false;
  if (!fieldMatchesWildcard(scheme.occupation, occupation)) return false;
  if (!fieldMatchesWildcard(scheme.state, state)) return false;
  if (!fieldMatchesWildcard(scheme.gender, gender)) return false;

  return true;
}

/**
 * Filter an in-memory list of schemes (useful for tests or cached data).
 */
export function filterEligibleSchemes(
  schemes: Scheme[],
  criteria: NormalizedEligibilityInput,
): Scheme[] {
  return schemes.filter((s) => isSchemeEligible(s, criteria));
}

/**
 * Prisma `where` clause mirroring {@link isSchemeEligible} for efficient DB-side filtering.
 */
export function buildEligibilityWhereInput(
  criteria: NormalizedEligibilityInput,
): Prisma.SchemeWhereInput {
  const { age, gender, state, income, occupation } = criteria;

  return {
    AND: [
      {
        OR: [{ min_age: null }, { min_age: { lte: age } }],
      },
      {
        OR: [{ max_age: null }, { max_age: { gte: age } }],
      },
      {
        OR: [{ income_limit: null }, { income_limit: { gte: income } }],
      },
      {
        OR: [
          { occupation: null },
          { occupation: { equals: "any" } },
          { occupation: { equals: occupation } },
        ],
      },
      {
        OR: [{ state: null }, { state: { equals: "any" } }, { state: { equals: state } }],
      },
      {
        OR: [{ gender: null }, { gender: { equals: "any" } }, { gender: { equals: gender } }],
      },
    ],
  };
}

/**
 * Load eligible schemes from the database using indexed filters where possible.
 */
export async function queryEligibleSchemes(
  criteria: NormalizedEligibilityInput,
): Promise<Scheme[]> {
  return prisma.scheme.findMany({
    where: buildEligibilityWhereInput(criteria),
    orderBy: { scheme_name: "asc" },
  });
}
