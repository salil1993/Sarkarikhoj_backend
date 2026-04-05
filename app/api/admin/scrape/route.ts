import { NextResponse } from "next/server";
import { z } from "zod";
import { probePortalUrl } from "@/services/ingestion/portalProbe";
import { requireAdminSecret } from "@/utils/adminAuth";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, jsonError, jsonRateLimited } from "@/utils/errors";
import { jsonPublicOk } from "@/utils/publicApi";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { formatValidationErrorDetails, logValidationFailure } from "@/utils/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  url: z.string().url().max(2048),
});

export async function POST(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`admin-scrape:${id}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }

    requireAdminSecret(request);

    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      logValidationFailure("admin-scrape", parsed.error);
      const d = formatValidationErrorDetails(parsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const probe = await probePortalUrl(parsed.data.url);

    return jsonPublicOk(
      {
        ...probe,
        hint: "Use /api/admin/import with CSV for durable ingestion; dedupe by slug.",
      },
      { headers: mergeHeaders(undefined, cors) },
    );
  } catch (err) {
    const res = handleRouteError(err, "admin-scrape");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
