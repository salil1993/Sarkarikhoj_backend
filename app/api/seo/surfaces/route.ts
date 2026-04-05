import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAnalyticsEvent } from "@/services/analyticsService";
import { getSeoSurface, type SeoSurfaceType } from "@/services/seoSurfaceService";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, jsonError, jsonRateLimited } from "@/utils/errors";
import { jsonPublicOk } from "@/utils/publicApi";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const typeSchema = z.enum(["category", "location", "income"]);

export async function GET(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`seo:surfaces:${id}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }

    const { searchParams } = new URL(request.url);
    const typeParsed = typeSchema.safeParse(searchParams.get("type")?.trim().toLowerCase());
    if (!typeParsed.success) {
      const res = jsonError(
        400,
        "VALIDATION_ERROR",
        "Query param `type` must be one of: category, location, income",
        {
          fields: [{ field: "type", error: "required enum: category | location | income" }],
        },
      );
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const type = typeParsed.data as SeoSurfaceType;
    const surface = await getSeoSurface(type, searchParams);
    if (!surface) {
      const res = jsonError(400, "VALIDATION_ERROR", "Missing or invalid parameters for this surface type.", {
        fields: [
          {
            field: "query",
            error:
              type === "category"
                ? "Provide slug= or category="
                : type === "location"
                  ? "Provide state= and optionally district="
                  : "Provide max_income= or income_max=",
          },
        ],
      });
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    void recordAnalyticsEvent("seo_surface", { type, ...surface.canonical_query });

    return jsonPublicOk(surface, { headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "seo-surfaces");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
