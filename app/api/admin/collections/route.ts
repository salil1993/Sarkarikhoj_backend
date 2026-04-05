import {
  createFeaturedCollection,
  listFeaturedCollectionsAdmin,
} from "@/services/featuredCollectionsService";
import { requireAdminSecret } from "@/utils/adminAuth";
import { featuredCollectionCreateSchema } from "@/utils/adminSchemas";
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
    const clientId = getClientIdentifier(request);
    const limited = await rateLimit(`admin-collections-list:${clientId}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }
    requireAdminSecret(request);

    const collections = await listFeaturedCollectionsAdmin();
    return jsonPublicOk({ collections }, { headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "admin-collections-list");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}

export async function POST(request: Request) {
  const cors = corsHeaders(request);
  try {
    const clientId = getClientIdentifier(request);
    const limited = await rateLimit(`admin-collections-create:${clientId}`);
    if (!limited.success) {
      return jsonRateLimited(limited.reset, cors);
    }
    requireAdminSecret(request);

    const body = await request.json().catch(() => null);
    const parsed = featuredCollectionCreateSchema.safeParse(body);
    if (!parsed.success) {
      logValidationFailure("admin-collections-create", parsed.error);
      const d = formatValidationErrorDetails(parsed.error);
      const res = jsonError(400, "VALIDATION_ERROR", d.message, d);
      return new NextResponse(res.body, {
        status: res.status,
        headers: mergeHeaders(res.headers, cors),
      });
    }

    const col = await createFeaturedCollection(parsed.data);
    return jsonPublicOk({ collection: col }, { status: 201, headers: mergeHeaders(undefined, cors) });
  } catch (err) {
    const res = handleRouteError(err, "admin-collections-create");
    return new NextResponse(res.body, {
      status: res.status,
      headers: mergeHeaders(res.headers, cors),
    });
  }
}
