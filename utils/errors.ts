import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiErrorBody } from "@/types/eligibility";

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
    error: details !== undefined ? { code, message, details } : { code, message },
  };
  return NextResponse.json(body, { status });
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
    return jsonError(400, "VALIDATION_ERROR", "Invalid request", zodToDetails(err));
  }
  const prismaRes = mapPrismaError(err);
  if (prismaRes) return prismaRes;

  logApiError(err, `${context}:unhandled`);
  return jsonError(500, "INTERNAL_ERROR", "Something went wrong");
}
