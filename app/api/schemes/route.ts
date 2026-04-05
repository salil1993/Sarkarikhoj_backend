import { NextResponse } from "next/server";
import { getSchemesList } from "@/controllers/schemesListController";
import { corsHeaders, mergeHeaders } from "@/utils/cors";
import { handleRouteError } from "@/utils/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const cors = corsHeaders(request);
  try {
    return await getSchemesList(request, cors);
  } catch (err) {
    const res = handleRouteError(err, "schemes");
    const h = mergeHeaders(res.headers, cors);
    return new NextResponse(res.body, { status: res.status, headers: h });
  }
}
