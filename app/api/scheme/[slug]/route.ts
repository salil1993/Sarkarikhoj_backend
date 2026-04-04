import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { HttpError, handleRouteError } from "@/utils/errors";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { parseSlugParam } from "@/utils/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

export async function OPTIONS(request: Request) {
  const cors = corsHeaders(request);
  return new NextResponse(null, { status: 204, headers: mergeHeaders(undefined, cors) });
}

export async function GET(request: Request, context: RouteContext) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`schemes:detail:${id}`);
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

    const { slug: rawSlug } = await context.params;
    const slugResult = parseSlugParam(rawSlug);
    if (!slugResult.success) {
      throw new HttpError(400, "INVALID_SLUG", "Invalid scheme slug");
    }

    const scheme = await prisma.scheme.findUnique({
      where: { slug: slugResult.data },
    });

    if (!scheme) {
      throw new HttpError(404, "NOT_FOUND", "Scheme not found");
    }

    return NextResponse.json(
      { ok: true, data: { scheme } },
      { status: 200, headers: mergeHeaders(undefined, cors) },
    );
  } catch (err) {
    const res = handleRouteError(err);
    const h = mergeHeaders(res.headers, cors);
    return new NextResponse(res.body, { status: res.status, headers: h });
  }
}
