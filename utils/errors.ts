import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiErrorBody } from "@/types/eligibility";
import { LEGAL_DISCLOSURE } from "@/services/legalDisclosure";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function zodToDetails(error: ZodError) {
  return error.flatten();
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    ok: false,
    legal: LEGAL_DISCLOSURE,
    error: details !== undefined ? { code, message, details } : { code, message },
  };
  return NextResponse.json(body, { status });
}

export function jsonRateLimited(
  reset: number | undefined,
  corsHeadersInit: Record<string, string> | undefined,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      ok: false,
      legal: LEGAL_DISCLOSURE,
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
        details: { reset },
      },
    },
    {
      status: 429,
      headers: {
        ...corsHeadersInit,
        "Retry-After": reset
          ? String(Math.max(1, Math.ceil((reset - Date.now()) / 1000)))
          : "60",
      },
    },
  );
}

/** Safe structured log — no connection strings or stack traces to stdout by default. */
function logApiError(err: unknown, context: string) {
  if (err instanceof HttpError) {
    console.error(`[api] ${context}`, { code: err.code, status: err.status });
    return;
  }
  if (err instanceof ZodError) {
    console.error(`[api] ${context}`, { code: "ZodError" });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`[api] ${context}`, { prismaCode: err.code });
    return;
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error(`[api] ${context}`, { type: "PrismaClientValidationError" });
    return;
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error(`[api] ${context}`, { type: "PrismaClientInitializationError" });
    return;
  }
  if (err instanceof Prisma.PrismaClientRustPanicError) {
    console.error(`[api] ${context}`, { type: "PrismaClientRustPanicError" });
    return;
  }
  const name = err instanceof Error ? err.name : "unknown";
  console.error(`[api] ${context}`, { name });
}

function mapPrismaError(err: unknown): NextResponse<ApiErrorBody> | null {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return jsonError(503, "DATABASE_UNAVAILABLE", "Database is temporarily unavailable.");
  }
  if (err instanceof Prisma.PrismaClientRustPanicError) {
    return jsonError(503, "DATABASE_ERROR", "Database is temporarily unavailable.");
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return jsonError(400, "INVALID_QUERY", "Invalid data request.");
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P1001":
      case "P1002":
      case "P1017":
        return jsonError(503, "DATABASE_UNAVAILABLE", "Database is temporarily unavailable.");
      case "P2025":
        return jsonError(404, "NOT_FOUND", "Record not found.");
      case "P2002":
        return jsonError(409, "CONFLICT", "A record with this unique value already exists.");
      default:
        return jsonError(503, "DATABASE_ERROR", "A database error occurred.");
    }
  }
  return null;
}

export function handleRouteError(err: unknown, context = "route"): NextResponse<ApiErrorBody> {
  if (err instanceof HttpError) {
    return jsonError(err.status, err.code, err.message, err.details);
  }
  if (err instanceof ZodError) {
    const flat = zodToDetails(err);
    const fields = err.issues.map((i) => ({
      field: i.path.length ? i.path.join(".") : "(root)",
      error: i.message,
    }));
    return jsonError(400, "VALIDATION_ERROR", "Invalid request", { ...flat, fields });
  }
  const prismaRes = mapPrismaError(err);
  if (prismaRes) return prismaRes;

  logApiError(err, `${context}:unhandled`);
  return jsonError(500, "INTERNAL_ERROR", "Something went wrong");
}
