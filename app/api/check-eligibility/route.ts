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
import { handleRouteError, jsonError } from "@/utils/errors";
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
  return `platform:elig:${h}`;
}

export async function POST(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`check-eligibility:${id}`);
    if (!limited.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
            details: { reset: limited.reset },
          },
        },
        {
          status: 429,
          headers: mergeHeaders(undefined, {
            ...cors,
            "Retry-After": limited.reset
              ? String(Math.max(1, Math.ceil((limited.reset - Date.now()) / 1000)))
              : "60",
          }),
        },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_JSON",
            message: "Request body must be valid JSON with Content-Type: application/json.",
            details: { hint: "Send a JSON object; see API docs for required fields." },
          },
        },
        { status: 400, headers: mergeHeaders(undefined, cors) },
      );
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
    const schemes = ids.map((sid) => schemeMap.get(sid)).filter((s): s is NonNullable<typeof s> => s != null);

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

    return NextResponse.json(
      {
        ok: true,
        data: {
          mode: options.mode,
          results,
          schemes,
          count: results.length,
        },
      },
      { status: 200, headers: mergeHeaders(undefined, cors) },
    );
  } catch (err) {
    const res = handleRouteError(err, "check-eligibility");
    const h = mergeHeaders(res.headers, cors);
    return new NextResponse(res.body, { status: res.status, headers: h });
  }
}
