import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { getTrendingCached } from "@/services/trendingService";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError } from "@/utils/errors";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

    const { searchParams } = new URL(request.url);
    const stateQ = searchParams.get("state")?.trim().toLowerCase();
    const categoryQ = searchParams.get("category")?.trim().toLowerCase();
    const sort = searchParams.get("sort")?.trim().toLowerCase();

    const clauses: Prisma.SchemeWhereInput[] = [];

    if (stateQ) {
      clauses.push({
        OR: [{ state: null }, { state: "any" }, { state: { equals: stateQ } }],
      });
    }

    if (categoryQ) {
      clauses.push({
        tags: {
          some: {
            tag: { slug: categoryQ },
          },
        },
      });
    }

    const where: Prisma.SchemeWhereInput = clauses.length > 0 ? { AND: clauses } : {};

    const schemes = await prisma.scheme.findMany({
      where: clauses.length > 0 ? where : undefined,
      include: {
        tags: { include: { tag: true } },
        benefitRows: { orderBy: { sort: "asc" } },
        documentRows: { orderBy: { sort: "asc" } },
      },
      orderBy: { scheme_name: "asc" },
    });

    if (sort === "trending") {
      const trending = await getTrendingCached(100);
      const order = new Map(trending.map((t, i) => [t.schemeId, i]));
      schemes.sort((a, b) => {
        const ra = order.has(a.id) ? order.get(a.id)! : 9999;
        const rb = order.has(b.id) ? order.get(b.id)! : 9999;
        if (ra !== rb) return ra - rb;
        return a.scheme_name.localeCompare(b.scheme_name);
      });
    }

    return NextResponse.json(
      { ok: true, data: { schemes, count: schemes.length } },
      { status: 200, headers: mergeHeaders(undefined, cors) },
    );
  } catch (err) {
    const res = handleRouteError(err, "schemes");
    const h = mergeHeaders(res.headers, cors);
    return new NextResponse(res.body, { status: res.status, headers: h });
  }
}
