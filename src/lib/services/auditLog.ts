import { db } from "@/lib/db";
import type { Ctx } from "@/lib/auth/context";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import type { Prisma } from "@prisma/client";

/** Append-only record of a money-moving or balance-changing action. Never edited or deleted. */
export async function logAudit(
  ctx: Ctx,
  entry: {
    action: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await db.auditLog.create({
    data: {
      actorId: ctx.userId,
      actorName: ctx.name,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function listAuditLog(ctx: Ctx, opts: { entityType?: string; entityId?: string; take?: number } = {}) {
  if (!can(ctx.role, "audit.view")) throw new ForbiddenError("audit.view");
  return db.auditLog.findMany({
    where: { entityType: opts.entityType, entityId: opts.entityId },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 100,
  });
}
