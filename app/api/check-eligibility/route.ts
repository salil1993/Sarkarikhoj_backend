import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { recordAnalyticsEvent } from "@/services/analyticsService";
import {
  inferUserTags,
  loadSchemesForScoring,
  scoreSchemes,
} from "@/services/eligibilityScoreEngine";
import { notifyHighMatch } from "@/services/notificationService";
import { ensureUserByExternalId } from "@/services/userService";
import { cacheGetJson, cacheSetJson } from "@/utils/cache";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, jsonError, jsonRateLimited } from "@/utils/errors";
import { jsonPublicOk } from "@/utils/publicApi";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import {
  formatValidationErrorDetails,
  logValidationFailure,
  parseCheckEligibilityFull,
} from "@/utils/validation";
import type { ScoredSchemeResult } from "@/types/platform";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ELIG_CACHE_TTL = 30;

function eligCacheKey(
  criteria: unknown,
  tags: string[],
  mode: string,
  limit: number,
): string {
  const h = createHash("sha256")
    .update(JSON.stringify({ criteria, tags, mode, limit }))
    .digest("hex")
    .slice(0, 40);
  return `platform:elig:v3:${h}`;
}

export async function POST(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`check-eligibility:${id}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      const res = jsonError(400, "INVALID_JSON", "Request body must be valid JSON.", {
        fields: [{ field: "body", error: "invalid_json" }],
      });
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const parsed = parseCheckEligibilityFull(body);
    if (!parsed.success) {
      logValidationFailure("check-eligibility", parsed.error);
      const details = formatValidationErrorDetails(parsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", details.message, details);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const { options } = parsed;
    const userTags = inferUserTags(options.criteria, options.tags);
    const ck = eligCacheKey(options.criteria, [...userTags], options.mode, options.limit);

    let results: ScoredSchemeResult[];
    if (options.mode === "scored") {
      const hit = await cacheGetJson<ScoredSchemeResult[]>(ck);
      if (hit) {
        results = hit;
      } else {
        const schemes = await loadSchemesForScoring();
        results = scoreSchemes(schemes, options.criteria, userTags, options.mode, options.limit);
        await cacheSetJson(ck, results, ELIG_CACHE_TTL);
      }
    } else {
      const schemes = await loadSchemesForScoring();
      results = scoreSchemes(schemes, options.criteria, userTags, options.mode, options.limit);
    }

    const ids = results.map((r) => r.schemeId);
    const schemeRows = await prisma.scheme.findMany({
      where: { id: { in: ids } },
    });
    const schemeMap = new Map(schemeRows.map((s) => [s.id, s]));
    const ordered = ids.map((sid) => schemeMap.get(sid)).filter((s): s is NonNullable<typeof s> => s != null);

    const schemes = ordered.map((s) => ({
      id: s.id,
      title: s.scheme_name,
      slug: s.slug,
      official_url: s.apply_link,
      last_updated: s.updated_at.toISOString(),
    }));

    void recordAnalyticsEvent("eligibility_check", {
      mode: options.mode,
      resultCount: results.length,
    });

    if (options.userExternalId) {
      const user = await ensureUserByExternalId(options.userExternalId.trim());
      await prisma.userEligibilityCheck.create({
        data: {
          userId: user.id,
          payload: options.criteria as object,
          results: { results } as object,
        },
      });
      void notifyHighMatch(user.id, results);
    }

    return jsonPublicOk(
      {
        mode: options.mode,
        results,
        schemes,
        count: results.length,
      },
      { headers: mergeHeaders(undefined, cors) },
    );
  } catch (err) {
    const res = handleRouteError(err, "check-eligibility");
    const h = mergeHeaders(res.headers, cors);
    return new NextResponse(res.body, { status: res.status, headers: h });
  }
}
