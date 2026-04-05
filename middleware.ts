import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { legalEnvelope } from "@/services/legalDisclosure";
import { corsHeaders } from "@/utils/cors";

/** Preflight + admin gate: `X-Admin-Secret` must match `ADMIN_SECRET` for `/api/admin/*` (except OPTIONS). */
export function middleware(request: NextRequest) {
  if (request.method === "OPTIONS") {
    const cors = corsHeaders(request);
    return new NextResponse(null, { status: 204, headers: new Headers(cors) });
  }

  if (request.nextUrl.pathname.startsWith("/api/admin")) {
    const secret = process.env.ADMIN_SECRET?.trim();
    if (!secret) {
      return NextResponse.json(
        legalEnvelope({
          ok: false,
          error: { code: "ADMIN_DISABLED", message: "Admin operations are not configured." },
        }),
        { status: 503 },
      );
    }
    const provided = request.headers.get("x-admin-secret")?.trim();
    if (provided !== secret) {
      return NextResponse.json(
        legalEnvelope({
          ok: false,
          error: { code: "UNAUTHORIZED", message: "Invalid admin credentials." },
        }),
        { status: 401 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
