import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, jsonError } from "@/utils/errors";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { formatValidationErrorDetails, logValidationFailure } from "@/utils/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchSchema = z.object({
  notificationIds: z.array(z.coerce.number().int().positive()).min(1).max(50),
  read: z.boolean(),
});

export async function GET(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`user-notif-get:${id}`);
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
          error: { code: "MISSING_USER", message: "Header X-User-Id required." },
        },
        { status: 400, headers: mergeHeaders(undefined, cors) },
      );
    }

    const user = await prisma.user.findUnique({ where: { externalId } });
    if (!user) {
      return NextResponse.json(
        { ok: false, error: { code: "USER_NOT_FOUND", message: "Unknown user." } },
        { status: 404, headers: mergeHeaders(undefined, cors) },
      );
    }

    const items = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(
      { ok: true, data: { notifications: items, count: items.length } },
      { status: 200, headers: mergeHeaders(undefined, cors) },
    );
  } catch (err) {
    const res = handleRouteError(err, "user-notifications-get");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}

export async function PATCH(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`user-notif-patch:${id}`);
    if (!limited.success) {
      return NextResponse.json(
        { ok: false, error: { code: "RATE_LIMITED", message: "Too many requests." } },
        { status: 429, headers: mergeHeaders(undefined, cors) },
      );
    }

    const externalId = request.headers.get("x-user-id")?.trim();
    if (!externalId) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_USER", message: "Header X-User-Id required." } },
        { status: 400, headers: mergeHeaders(undefined, cors) },
      );
    }

    const user = await prisma.user.findUnique({ where: { externalId } });
    if (!user) {
      return NextResponse.json(
        { ok: false, error: { code: "USER_NOT_FOUND", message: "Unknown user." } },
        { status: 404, headers: mergeHeaders(undefined, cors) },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      logValidationFailure("user-notifications-patch", parsed.error);
      const d = formatValidationErrorDetails(parsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        id: { in: parsed.data.notificationIds },
      },
      data: { isRead: parsed.data.read },
    });

    return NextResponse.json(
      { ok: true, data: { updated: true } },
      { status: 200, headers: mergeHeaders(undefined, cors) },
    );
  } catch (err) {
    const res = handleRouteError(err, "user-notifications-patch");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
