import { prisma } from "@/db/client";
import { inferUserTags, loadSchemesForScoring, scoreSchemes } from "@/services/eligibilityScoreEngine";
import { getTrendingCached } from "@/services/trendingService";
import type { NormalizedEligibilityInput } from "@/types/eligibility";

function isCriteriaPayload(v: unknown): v is NormalizedEligibilityInput {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.age === "number" &&
    typeof o.gender === "string" &&
    typeof o.state === "string" &&
    typeof o.income === "number" &&
    typeof o.occupation === "string"
  );
}

export async function buildUserRecommendations(externalId: string) {
  const user = await prisma.user.findUnique({
    where: { externalId },
    include: {
      savedSchemes: {
        where: { scheme: { publishStatus: "published" } },
        include: {
          scheme: { select: { id: true, slug: true, scheme_name: true, apply_link: true } },
        },
      },
      checks: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!user) {
    return { ok: false as const, code: "USER_NOT_FOUND" as const };
  }

  const trending = await getTrendingCached(12);
  let personalizedMatches: ReturnType<typeof scoreSchemes> = [];
  const last = user.checks[0];
  if (last?.payload && isCriteriaPayload(last.payload)) {
    const schemes = await loadSchemesForScoring();
    const tags = inferUserTags(last.payload, []);
    personalizedMatches = scoreSchemes(schemes, last.payload, tags, "scored", 12);
  }

  return {
    ok: true as const,
    userId: user.id,
    externalId: user.externalId,
    savedSchemes: user.savedSchemes.map((s) => s.scheme),
    trending,
    personalizedMatches,
  };
}
