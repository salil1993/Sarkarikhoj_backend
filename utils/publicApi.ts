import { NextResponse } from "next/server";
import { legalEnvelope } from "@/services/legalDisclosure";
import type { LegalDisclosure } from "@/types/legal";

export type PublicSuccessBody<T> = { ok: true; legal: LegalDisclosure; data: T };

export function jsonPublicOk<T>(
  data: T,
  init?: { status?: number; headers?: HeadersInit },
): NextResponse<PublicSuccessBody<T>> {
  return NextResponse.json(legalEnvelope({ ok: true, data }) as PublicSuccessBody<T>, {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}
