import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { corsHeaders } from "@/utils/cors";

/** Preflight only; route handlers still attach CORS on GET/POST JSON responses (reliable merge on Vercel). */
export function middleware(request: NextRequest) {
  if (request.method !== "OPTIONS") {
    return NextResponse.next();
  }

  const cors = corsHeaders(request);
  return new NextResponse(null, { status: 204, headers: new Headers(cors) });
}

export const config = {
  matcher: "/api/:path*",
};
