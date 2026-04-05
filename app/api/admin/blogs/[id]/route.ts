import { blogsAdmin } from "@/controllers/admin/blogsAdminController";
import { requireAdminSecret } from "@/utils/adminAuth";
import { blogUpdateSchema, idParamSchema } from "@/utils/adminSchemas";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, HttpError, jsonError, jsonRateLimited } from "@/utils/errors";
import { jsonPublicOk } from "@/utils/publicApi";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { formatValidationErrorDetails, logValidationFailure } from "@/utils/validation";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: RouteCtx) {
  const cors = corsHeaders(request);
  try {
    const clientId = getClientIdentifier(request);
    const limited = await rateLimit(`admin-blogs-update:${clientId}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }
    requireAdminSecret(request);

    const params = await ctx.params;
    const idParsed = idParamSchema.safeParse({ id: params.id });
    if (!idParsed.success) {
      logValidationFailure("admin-blogs-update", idParsed.error);
      const d = formatValidationErrorDetails(idParsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const body = await request.json().catch(() => null);
    const parsed = blogUpdateSchema.safeParse(body);
    if (!parsed.success) {
      logValidationFailure("admin-blogs-update", parsed.error);
      const d = formatValidationErrorDetails(parsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const blog = await blogsAdmin.update(idParsed.data.id, parsed.data);
    if (!blog) {
      throw new HttpError(404, "NOT_FOUND", "Blog not found.");
    }
    return jsonPublicOk({ blog }, { headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "admin-blogs-update");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}

export async function DELETE(request: Request, ctx: RouteCtx) {
  const cors = corsHeaders(request);
  try {
    const clientId = getClientIdentifier(request);
    const limited = await rateLimit(`admin-blogs-delete:${clientId}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }
    requireAdminSecret(request);

    const params = await ctx.params;
    const idParsed = idParamSchema.safeParse({ id: params.id });
    if (!idParsed.success) {
      logValidationFailure("admin-blogs-delete", idParsed.error);
      const d = formatValidationErrorDetails(idParsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const ok = await blogsAdmin.delete(idParsed.data.id);
    if (!ok) {
      throw new HttpError(404, "NOT_FOUND", "Blog not found.");
    }
    return jsonPublicOk({ deleted: true, id: idParsed.data.id }, { headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "admin-blogs-delete");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
