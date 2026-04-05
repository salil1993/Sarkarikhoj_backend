import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { recordAnalyticsEvent } from "@/services/analyticsService";
import { toPublicSchemeDetail, type SchemeDetailInclude } from "@/services/schemePresenter";
import { HttpError, handleRouteError, jsonRateLimited } from "@/utils/errors";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { jsonPublicOk } from "@/utils/publicApi";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { parseSlugParam } from "@/utils/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`schemes:detail:${id}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }

    const { slug: rawSlug } = await context.params;
    const slugResult = parseSlugParam(rawSlug);
    if (!slugResult.success) {
      throw new HttpError(400, "INVALID_SLUG", "Invalid scheme slug");
    }

    const scheme = await prisma.scheme.findUnique({
      where: { slug: slugResult.data },
      include: {
        tags: { include: { tag: true } },
        eligibilityRules: true,
        benefitRows: { orderBy: { sort: "asc" } },
        documentRows: { orderBy: { sort: "asc" } },
        faqs: { orderBy: { sort: "asc" } },
      },
    });

    if (!scheme || scheme.publishStatus !== "published") {
      throw new HttpError(404, "NOT_FOUND", "Scheme not found");
    }

    void prisma.schemeEngagement
      .create({
        data: { schemeId: scheme.id, type: "view" },
      })
      .catch(() => {});
    void recordAnalyticsEvent("scheme_view", { schemeId: scheme.id, slug: scheme.slug });

    const publicScheme = toPublicSchemeDetail(scheme as SchemeDetailInclude);

    return jsonPublicOk({ scheme: publicScheme }, { headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "scheme-by-slug");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
