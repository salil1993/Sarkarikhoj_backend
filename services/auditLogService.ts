import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";

export type AuditActor = "admin_secret" | "admin_user" | "system";

export async function recordAuditLog(input: {
  actor: AuditActor;
  adminUserId?: number | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actor: input.actor,
        adminUserId: input.adminUserId ?? null,
        action: input.action.slice(0, 128),
        resource: input.resource.slice(0, 64),
        resourceId: input.resourceId?.slice(0, 64) ?? null,
        meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: input.ip?.slice(0, 64) ?? null,
      },
    });
  } catch (e) {
    console.error("[audit] record failed", { action: input.action, resource: input.resource });
  }
}
