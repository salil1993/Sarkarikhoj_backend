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

export function handleRouteError(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof HttpError) {
    return jsonError(err.status, err.code, err.message, err.details);
  }
  if (err instanceof ZodError) {
    return jsonError(400, "VALIDATION_ERROR", "Invalid request", zodToDetails(err));
  }
  console.error("[api] unhandled error", err);
  return jsonError(500, "INTERNAL_ERROR", "Something went wrong");
}
