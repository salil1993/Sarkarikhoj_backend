import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/services/analyticsService";
import { requireAdminSecret } from "@/utils/adminAuth";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, jsonRateLimited } from "@/utils/errors";
import { jsonPublicOk } from "@/utils/publicApi";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`analytics-dash:${id}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }

    requireAdminSecret(request);
    const summary = await getDashboardSummary();

    return jsonPublicOk(summary, { headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "analytics-dashboard");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
