import { listPublicSchemes } from "@/services/schemesQueryService";
import { recordAnalyticsEvent } from "@/services/analyticsService";
import { mergeHeaders } from "@/utils/cors";
import { jsonRateLimited } from "@/utils/errors";
import { jsonPublicOk } from "@/utils/publicApi";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";

/**
 * HTTP handler for `GET /api/schemes` (list + filters + public SEO shape + legal envelope).
 */
export async function getSchemesList(request: Request, cors: Record<string, string>) {
  const id = getClientIdentifier(request);
  const limited = await rateLimit(`schemes:list:${id}`);
  if (!limited.success) {
    return jsonRateLimited(limited.reset, cors);
  }

  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state")?.trim().toLowerCase();
  const district = searchParams.get("district")?.trim().toLowerCase();
  const category = searchParams.get("category")?.trim().toLowerCase();
  const sort = searchParams.get("sort")?.trim().toLowerCase();
  const q = searchParams.get("q")?.trim() || searchParams.get("search")?.trim();

  if (q && q.length > 0) {
    const normalized = q.replace(/\s+/g, " ").trim().toLowerCase();
    const queryPrefix = normalized.slice(0, 64);
    void recordAnalyticsEvent("scheme_search", {
      qLen: q.length,
      queryPrefix: queryPrefix || undefined,
      hasState: Boolean(state),
      hasDistrict: Boolean(district),
    });
  }

  const schemes = await listPublicSchemes({
    state: state || undefined,
    district: district || undefined,
    category: category || undefined,
    sort: sort || undefined,
    q: q || undefined,
  });

  return jsonPublicOk({ schemes, count: schemes.length }, { headers: mergeHeaders(undefined, cors) });
}
