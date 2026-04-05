import { NextResponse } from "next/server";
import { queryEligibleSchemes } from "@/services/eligibilityEngine";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, jsonError } from "@/utils/errors";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { parseEligibilityBody } from "@/utils/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`check-eligibility:${id}`);
    if (!limited.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
            details: { reset: limited.reset },
          },
        },
        {
          status: 429,
          headers: mergeHeaders(undefined, {
            ...cors,
            "Retry-After": limited.reset
              ? String(Math.max(1, Math.ceil((limited.reset - Date.now()) / 1000)))
              : "60",
          }),
        },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_JSON", message: "Request body must be JSON" } },
        { status: 400, headers: mergeHeaders(undefined, cors) },
      );
    }

    const parsed = parseEligibilityBody(body);
    if (!parsed.success) {
      const res = jsonError(
        400,
        "VALIDATION_ERROR",
        "Invalid eligibility payload",
        parsed.error.flatten(),
      );
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const schemes = await queryEligibleSchemes(parsed.data);

    return NextResponse.json(
      { ok: true, data: { schemes, count: schemes.length } },
      { status: 200, headers: mergeHeaders(undefined, cors) },
    );
  } catch (err) {
    const res = handleRouteError(err, "check-eligibility");
    const h = mergeHeaders(res.headers, cors);
    return new NextResponse(res.body, { status: res.status, headers: h });
  }
}
