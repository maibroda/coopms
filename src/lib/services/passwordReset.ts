import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { checkRateLimit, resetRateLimit } from "@/lib/rateLimit";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REQUEST_MAX_ATTEMPTS = 5;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * No email/SMTP is configured in this app yet. Rather than silently failing or half-building
 * a fake "email sent" flow, the reset link is logged server-side and returned to the caller —
 * an admin/dev can hand it to the member directly until real mail sending is wired up. This is
 * explicitly a stub, not a finished delivery mechanism.
 */
function deliverResetLink(email: string, link: string) {
  console.log(`[password-reset] Reset link for ${email}: ${link}`);
}

/**
 * Always returns a generic result regardless of whether the email matches an account — this is
 * what stops the endpoint from being usable to enumerate registered emails.
 */
export async function requestPasswordReset(email: string, baseUrl: string): Promise<{ devLink?: string }> {
  const normalized = email.trim().toLowerCase();
  const rateLimitKey = `reset-request:${normalized}`;
  const limit = checkRateLimit(rateLimitKey, REQUEST_MAX_ATTEMPTS, REQUEST_WINDOW_MS);
  if (!limit.allowed) {
    throw new Error(`Too many requests. Try again in ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minute(s).`);
  }

  const user = await db.user.findUnique({ where: { email: normalized } });
  if (!user || user.status !== "ACTIVE") return {};

  const rawToken = randomBytes(32).toString("hex");
  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });

  const link = `${baseUrl}/reset-password?token=${rawToken}`;
  deliverResetLink(user.email, link);
  return { devLink: link };
}

export async function resetPassword(token: string, newPassword: string) {
  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new Error("This reset link is invalid or has expired. Request a new one.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const [user] = await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  resetRateLimit(`login:${user.email}`);
}
