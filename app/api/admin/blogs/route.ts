import { blogsAdmin } from "@/controllers/admin/blogsAdminController";
import { requireAdminSecret } from "@/utils/adminAuth";
import { parsePaginationFromUrl } from "@/utils/adminPagination";
import { blogCreateSchema } from "@/utils/adminSchemas";
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
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`admin-blogs-list:${id}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }
    requireAdminSecret(request);

    const paged = parsePaginationFromUrl(request.url);
    if (!paged.success) {
      logValidationFailure("admin-blogs-list", paged.error);
      const d = formatValidationErrorDetails(paged.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const data = await blogsAdmin.list(paged.data.page, paged.data.limit);
    return jsonPublicOk(data, { headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "admin-blogs-list");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}

export async function POST(request: Request) {
  const cors = corsHeaders(request);
  try {
    const id = getClientIdentifier(request);
    const limited = await rateLimit(`admin-blogs-create:${id}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }
    requireAdminSecret(request);

    const body = await request.json().catch(() => null);
    const parsed = blogCreateSchema.safeParse(body);
    if (!parsed.success) {
      logValidationFailure("admin-blogs-create", parsed.error);
      const d = formatValidationErrorDetails(parsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const blog = await blogsAdmin.create(parsed.data);
    return jsonPublicOk({ blog }, { status: 201, headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "admin-blogs-create");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
