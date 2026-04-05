import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserByExternalId } from "@/services/userService";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, jsonError, jsonRateLimited } from "@/utils/errors";
import { jsonPublicOk } from "@/utils/publicApi";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { formatValidationErrorDetails, logValidationFailure } from "@/utils/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  externalId: z.string().min(8).max(64),
  email: z.string().email().optional(),
  profile: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`user-register:${id}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }

    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      logValidationFailure("user-register", parsed.error);
      const d = formatValidationErrorDetails(parsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const user = await ensureUserByExternalId(parsed.data.externalId.trim());
    if (parsed.data.email ?? parsed.data.profile) {
      const { prisma } = await import("@/db/client");
      const data: { email?: string; profile?: object } = {};
      if (parsed.data.email) data.email = parsed.data.email;
      if (parsed.data.profile) data.profile = parsed.data.profile;
      if (Object.keys(data).length > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data,
        });
      }
    }

    return jsonPublicOk(
      { userId: user.id, externalId: user.externalId },
      { headers: mergeHeaders(undefined, cors) },
    );
  } catch (err) {
    const res = handleRouteError(err, "user-register");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
