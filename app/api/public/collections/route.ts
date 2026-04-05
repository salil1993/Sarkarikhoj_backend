import { listPublishedFeaturedCollections } from "@/services/featuredCollectionsService";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, jsonRateLimited } from "@/utils/errors";
import { jsonPublicOk } from "@/utils/publicApi";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Published featured / curated scheme collections for homepage and landing blocks. */
export async function GET(request: Request) {
  const cors = corsHeaders(request);
  try {
    const clientId = getClientIdentifier(request);
    const limited = await rateLimit(`public-collections:${clientId}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug")?.trim();
    const all = await listPublishedFeaturedCollections();
    const collections = slug ? all.filter((c) => c.slug === slug) : all;

    return jsonPublicOk(
      { collections, count: collections.length },
      { headers: mergeHeaders(undefined, cors) },
    );
  } catch (err) {
    const res = handleRouteError(err, "public-collections");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
