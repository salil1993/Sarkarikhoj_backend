import { NextResponse } from "next/server";
import { z } from "zod";
import { importSchemesFromCsvRows, parseCsv } from "@/services/ingestion/importCsv";
import { requireAdminSecret } from "@/utils/adminAuth";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, jsonError, jsonRateLimited } from "@/utils/errors";
import { jsonPublicOk } from "@/utils/publicApi";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { formatValidationErrorDetails, logValidationFailure } from "@/utils/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  csv: z.string().min(10).max(2_000_000),
});

export async function POST(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`admin-import:${id}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }

    requireAdminSecret(request);

    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      logValidationFailure("admin-import", parsed.error);
      const d = formatValidationErrorDetails(parsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const rows = parseCsv(parsed.data.csv);
    const result = await importSchemesFromCsvRows(rows);

    return jsonPublicOk(
      { upserted: result.upserted, errors: result.errors },
      { headers: mergeHeaders(undefined, cors) },
    );
  } catch (err) {
    const res = handleRouteError(err, "admin-import");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
