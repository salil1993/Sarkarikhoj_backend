import { listAllSiteSettings, upsertSiteSettings } from "@/services/siteSettingsService";
import { requireAdminSecret } from "@/utils/adminAuth";
import { adminSettingsPutSchema } from "@/utils/adminSchemas";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, jsonError, jsonRateLimited } from "@/utils/errors";
import { jsonPublicOk } from "@/utils/publicApi";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { formatValidationErrorDetails, logValidationFailure } from "@/utils/validation";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const cors = corsHeaders(request);
  try {
    const clientId = getClientIdentifier(request);
    const limited = await rateLimit(`admin-settings-list:${clientId}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }
    requireAdminSecret(request);

    const settings = await listAllSiteSettings();
    return jsonPublicOk({ settings }, { headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "admin-settings-list");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}

export async function PUT(request: Request) {
  const cors = corsHeaders(request);
  try {
    const clientId = getClientIdentifier(request);
    const limited = await rateLimit(`admin-settings-put:${clientId}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }
    requireAdminSecret(request);

    const body = await request.json().catch(() => null);
    const parsed = adminSettingsPutSchema.safeParse(body);
    if (!parsed.success) {
      logValidationFailure("admin-settings-put", parsed.error);
      const d = formatValidationErrorDetails(parsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const updated = await upsertSiteSettings(
      parsed.data.settings as Array<{ key: string; value: unknown }>,
    );
    return jsonPublicOk({ updated }, { headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "admin-settings-put");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
