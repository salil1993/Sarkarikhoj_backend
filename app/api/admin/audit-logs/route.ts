import { prisma } from "@/db/client";
import { requireAdminSecret } from "@/utils/adminAuth";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, jsonError, jsonRateLimited } from "@/utils/errors";
import { jsonPublicOk } from "@/utils/publicApi";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(5000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  resource: z.string().max(64).optional(),
});

export async function GET(request: Request) {
  const cors = corsHeaders(request);
  try {
    const clientId = getClientIdentifier(request);
    const limited = await rateLimit(`admin-audit-logs:${clientId}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }
    requireAdminSecret(request);

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      const res = jsonError(400, "VALIDATION_ERROR", "Invalid query");
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const { page, limit, resource } = parsed.data;
    const skip = (page - 1) * limit;
    const where = resource ? { resource } : {};

    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return jsonPublicOk(
      {
        logs: rows.map((r) => ({
          id: r.id,
          actor: r.actor,
          adminUserId: r.adminUserId,
          action: r.action,
          resource: r.resource,
          resourceId: r.resourceId,
          meta: r.meta,
          ip: r.ip,
          createdAt: r.createdAt.toISOString(),
        })),
        total,
        page,
        limit,
      },
      { headers: mergeHeaders(undefined, cors) },
    );
  } catch (err) {
    const res = handleRouteError(err, "admin-audit-logs");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
