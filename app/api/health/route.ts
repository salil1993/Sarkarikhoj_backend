import { NextResponse } from "next/server";
import { prisma } from "@/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * Liveness + optional DB readiness (does not fail HTTP if DB is down — see `db` flag).
 */
export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    console.error("[api] health: database check failed");
  }

  return NextResponse.json({ ok: true, db });
}
