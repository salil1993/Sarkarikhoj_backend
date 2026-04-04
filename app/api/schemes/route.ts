import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError } from "@/utils/errors";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS(request: Request) {
  const cors = corsHeaders(request);
  return new NextResponse(null, { status: 204, headers: mergeHeaders(undefined, cors) });
}

export async function GET(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`schemes:list:${id}`);
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
        { status: 429, headers: mergeHeaders(undefined, cors) },
      );
    }

    const schemes = await prisma.scheme.findMany({
      orderBy: { scheme_name: "asc" },
    });

    return NextResponse.json(
      { ok: true, data: { schemes, count: schemes.length } },
      { status: 200, headers: mergeHeaders(undefined, cors) },
    );
  } catch (err) {
    const res = handleRouteError(err);
    const h = mergeHeaders(res.headers, cors);
    return new NextResponse(res.body, { status: res.status, headers: h });
  }
}
