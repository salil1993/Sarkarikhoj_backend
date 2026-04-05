import { describe, expect, it } from "vitest";
import { normalizeScoredResultsForClient } from "@/utils/eligibilityResponseNormalize";

describe("normalizeScoredResultsForClient", () => {
  it("fills missing arrays and strings for client-safe payloads", () => {
    const raw = [
      {
        schemeId: 1,
        slug: "test-scheme",
        scheme_name: "Test",
        title: "Test",
        apply_link: "https://example.gov/",
        official_url: "https://example.gov/",
        last_updated: "2026-01-01T00:00:00.000Z",
        eligibilityScore: 80,
      },
    ];
    const out = normalizeScoredResultsForClient(raw as unknown[]);
    expect(out).toHaveLength(1);
    expect(out[0].matchedCriteria).toEqual([]);
    expect(out[0].missingCriteria).toEqual([]);
    expect(out[0].eligibilityScore).toBe(80);
  });

  it("drops invalid rows", () => {
    const out = normalizeScoredResultsForClient([{ schemeId: 0, slug: "x" }] as unknown[]);
    expect(out).toHaveLength(0);
  });
});
