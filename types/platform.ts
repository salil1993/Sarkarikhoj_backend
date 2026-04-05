import type { NormalizedEligibilityInput } from "@/types/eligibility";

export type EligibilityMode = "strict" | "scored";

export type ScoredSchemeResult = {
  schemeId: number;
  slug: string;
  scheme_name: string;
  apply_link: string;
  eligibilityScore: number;
  matchedCriteria: string[];
  missingCriteria: string[];
};

export type CheckEligibilityOptions = {
  mode: EligibilityMode;
  limit: number;
  userExternalId?: string;
  tags: string[];
  criteria: NormalizedEligibilityInput;
};

export type TrendingRow = {
  schemeId: number;
  slug: string;
  scheme_name: string;
  trendingScore: number;
};
