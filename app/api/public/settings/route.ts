import { getPublicLegalAndUiSettings } from "@/services/siteSettingsService";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, jsonRateLimited } from "@/utils/errors";
import { jsonPublicOk } from "@/utils/publicApi";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public compliance + UI labels (admin-editable via site_settings).
 * Frontend should merge `data.legal` for prominent disclaimers; API envelopes still ship static legal by default.
 */
export async function GET(request: Request) {
  const cors = corsHeaders(request);
  try {
    const clientId = getClientIdentifier(request);
    const limited = await rateLimit(`public-settings:${clientId}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }

    const data = await getPublicLegalAndUiSettings();
    return jsonPublicOk(data, { headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "public-settings");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
