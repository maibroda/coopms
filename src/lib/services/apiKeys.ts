import { randomBytes, createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { Ctx } from "@/lib/auth/context";
import { can, ForbiddenError } from "@/lib/auth/permissions";

function requirePerm(ctx: Ctx) {
  if (!can(ctx.role, "settings.manage")) throw new ForbiddenError("settings.manage");
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Returns the plaintext key ONCE — only its hash and a short preview are stored. */
export async function createApiKey(ctx: Ctx, label: string): Promise<{ id: string; plaintext: string }> {
  requirePerm(ctx);
  const plaintext = `coopms_${randomBytes(24).toString("hex")}`;
  const row = await db.apiKey.create({
    data: {
      label: label.trim() || "Untitled integration",
      keyHash: hashKey(plaintext),
      keyPreview: plaintext.slice(-6),
      createdById: ctx.userId,
    },
  });
  return { id: row.id, plaintext };
}

export async function listApiKeys(ctx: Ctx) {
  requirePerm(ctx);
  return db.apiKey.findMany({ orderBy: { createdAt: "desc" } });
}

export async function revokeApiKey(ctx: Ctx, id: string) {
  requirePerm(ctx);
  return db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
}

/** Validates a bearer token against stored key hashes for the /api/v1 integration API. */
export async function verifyApiKey(bearer: string | null): Promise<boolean> {
  if (!bearer) return false;
  const key = await db.apiKey.findUnique({ where: { keyHash: hashKey(bearer) } });
  if (!key || key.revokedAt) return false;
  await db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return true;
}
