import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { invalidateTrendingCache } from "@/services/trendingService";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, jsonError } from "@/utils/errors";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { formatValidationErrorDetails, logValidationFailure } from "@/utils/validation";
import { ensureUserByExternalId } from "@/services/userService";
import { recordAnalyticsEvent } from "@/services/analyticsService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    schemeId: z.coerce.number().int().positive().optional(),
    slug: z.string().min(1).max(255).optional(),
    type: z.enum(["view", "click", "share"]),
    userId: z.string().max(64).optional(),
  })
  .refine((d) => d.schemeId != null || (d.slug != null && d.slug.length > 0), {
    message: "Provide schemeId or slug",
    path: ["schemeId"],
  });

export async function POST(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`engagements:${id}`);
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
        { status: 429, headers: mergeHeaders(undefined, cors) },
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
            message: "JSON body required",
            details: { field: "body", error: "invalid_json" },
          },
        },
        { status: 400, headers: mergeHeaders(undefined, cors) },
      );
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      logValidationFailure("engagements", parsed.error);
      const details = formatValidationErrorDetails(parsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", details.message, details);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const { schemeId: sid, slug, type, userId: extUser } = parsed.data;
    let schemeId = sid ?? null;
    if (schemeId == null && slug) {
      const s = await prisma.scheme.findUnique({ where: { slug: slug.trim() } });
      if (!s) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "NOT_FOUND",
              message: "Scheme not found",
              details: { field: "slug", error: "unknown_slug" },
            },
          },
          { status: 404, headers: mergeHeaders(undefined, cors) },
        );
      }
      schemeId = s.id;
    }

    let userDbId: number | undefined;
    if (extUser?.trim()) {
      const u = await ensureUserByExternalId(extUser.trim());
      userDbId = u.id;
    }

    await prisma.schemeEngagement.create({
      data: {
        schemeId: schemeId!,
        type,
        userId: userDbId,
      },
    });

    void recordAnalyticsEvent(
      type === "view" ? "scheme_view" : type === "click" ? "scheme_click" : "scheme_share",
      { schemeId },
    );
    void invalidateTrendingCache();

    return NextResponse.json(
      { ok: true, data: { recorded: true, schemeId, type } },
      { status: 201, headers: mergeHeaders(undefined, cors) },
    );
  } catch (err) {
    const res = handleRouteError(err, "engagements");
    const h = mergeHeaders(res.headers, cors);
    return new NextResponse(res.body, { status: res.status, headers: h });
  }
}
