import type { NormalizedEligibilityInput } from "@/types/eligibility";

export type EligibilityMode = "strict" | "scored";

export type ScoredSchemeResult = {
  schemeId: number;
  slug: string;
  /** @deprecated use title */
  scheme_name: string;
  title: string;
  /** @deprecated use official_url */
  apply_link: string;
  official_url: string;
  last_updated: string;
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
  title: string;
  official_url: string;
  last_updated: string;
  trendingScore: number;
};
