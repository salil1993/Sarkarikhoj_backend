import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAnalyticsEvent, type AnalyticsEventType } from "@/services/analyticsService";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, jsonError, jsonRateLimited } from "@/utils/errors";
import { jsonPublicOk } from "@/utils/publicApi";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { formatValidationErrorDetails, logValidationFailure } from "@/utils/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  eventType: z.enum(["conversion", "scheme_search", "scheme_click", "scheme_view", "scheme_share"]),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`analytics:event:${id}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      const res = jsonError(400, "INVALID_JSON", "JSON body required");
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      logValidationFailure("analytics-event", parsed.error);
      const d = formatValidationErrorDetails(parsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    await recordAnalyticsEvent(parsed.data.eventType as AnalyticsEventType, parsed.data.meta ?? {});

    return jsonPublicOk({ recorded: true }, { headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "analytics-event");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
