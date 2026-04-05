import { NextResponse } from "next/server";
import { getTrendingCached } from "@/services/trendingService";
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
    const limited = await rateLimit(`schemes:trending:${id}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1), 50);
    const trending = await getTrendingCached(limit);

    return jsonPublicOk({ trending, count: trending.length }, { headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "schemes-trending");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
