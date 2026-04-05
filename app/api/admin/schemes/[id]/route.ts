import { schemesAdmin } from "@/controllers/admin/schemesAdminController";
import { recordAuditLog } from "@/services/auditLogService";
import { requireAdminSecret } from "@/utils/adminAuth";
import { idParamSchema, schemeUpdateSchema } from "@/utils/adminSchemas";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError, HttpError, jsonError, jsonRateLimited } from "@/utils/errors";
import { jsonPublicOk } from "@/utils/publicApi";
import { getClientIdentifier, rateLimit } from "@/utils/rateLimit";
import { getClientIp } from "@/utils/requestMeta";
import { formatValidationErrorDetails, logValidationFailure } from "@/utils/validation";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: RouteCtx) {
  const cors = corsHeaders(request);
  try {
    const clientId = getClientIdentifier(request);
    const limited = await rateLimit(`admin-schemes-update:${clientId}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }
    requireAdminSecret(request);

    const params = await ctx.params;
    const idParsed = idParamSchema.safeParse({ id: params.id });
    if (!idParsed.success) {
      logValidationFailure("admin-schemes-update", idParsed.error);
      const d = formatValidationErrorDetails(idParsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const body = await request.json().catch(() => null);
    const parsed = schemeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      logValidationFailure("admin-schemes-update", parsed.error);
      const d = formatValidationErrorDetails(parsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const scheme = await schemesAdmin.update(idParsed.data.id, parsed.data);
    if (!scheme) {
      throw new HttpError(404, "NOT_FOUND", "Scheme not found.");
    }
    void recordAuditLog({
      actor: "admin_secret",
      action: "scheme.update",
      resource: "scheme",
      resourceId: String(scheme.id),
      meta: { slug: scheme.slug },
      ip: getClientIp(request),
    });
    return jsonPublicOk({ scheme }, { headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "admin-schemes-update");
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
    const limited = await rateLimit(`admin-schemes-delete:${clientId}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }
    requireAdminSecret(request);

    const params = await ctx.params;
    const idParsed = idParamSchema.safeParse({ id: params.id });
    if (!idParsed.success) {
      logValidationFailure("admin-schemes-delete", idParsed.error);
      const d = formatValidationErrorDetails(idParsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const ok = await schemesAdmin.delete(idParsed.data.id);
    if (!ok) {
      throw new HttpError(404, "NOT_FOUND", "Scheme not found.");
    }
    void recordAuditLog({
      actor: "admin_secret",
      action: "scheme.delete",
      resource: "scheme",
      resourceId: String(idParsed.data.id),
      ip: getClientIp(request),
    });
    return jsonPublicOk({ deleted: true, id: idParsed.data.id }, { headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "admin-schemes-delete");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
