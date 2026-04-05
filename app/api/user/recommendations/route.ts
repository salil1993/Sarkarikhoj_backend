import { NextResponse } from "next/server";
import { buildUserRecommendations } from "@/services/userRecommendations";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError } from "@/utils/errors";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`user-recs:${id}`);
    if (!limited.success) {
      return NextResponse.json(
        { ok: false, error: { code: "RATE_LIMITED", message: "Too many requests." } },
        { status: 429, headers: mergeHeaders(undefined, cors) },
      );
    }

    const externalId = request.headers.get("x-user-id")?.trim();
    if (!externalId) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "MISSING_USER",
            message: "Send header X-User-Id (client-generated UUID).",
            details: { field: "X-User-Id", error: "required" },
          },
        },
        { status: 400, headers: mergeHeaders(undefined, cors) },
      );
    }

    const data = await buildUserRecommendations(externalId);
    if (!data.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "Register via POST /api/user/register first.",
            details: { field: "X-User-Id", error: "unknown_user" },
          },
        },
        { status: 404, headers: mergeHeaders(undefined, cors) },
      );
    }

    return NextResponse.json({ ok: true, data }, { status: 200, headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "user-recommendations");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
