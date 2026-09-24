import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { checkRateLimit, resetRateLimit } from "@/lib/rateLimit";
import type { Role } from "@/lib/auth/permissions";

const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ACTIVATION_MAX_ATTEMPTS = 8;
const ACTIVATION_WINDOW_MS = 15 * 60 * 1000;

export async function authenticate(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const rateLimitKey = `login:${normalized}`;
  const limit = checkRateLimit(rateLimitKey, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
  if (!limit.allowed) {
    throw new Error(`Too many attempts. Try again in ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minute(s).`);
  }

  const user = await db.user.findUnique({ where: { email: normalized } });
  if (!user || user.status !== "ACTIVE") throw new Error("Invalid email or password.");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error("Invalid email or password.");
  resetRateLimit(rateLimitKey);
  return user;
}

export async function createUser(input: { email: string; password: string; name: string; role: Role; memberId?: string | null }) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  return db.user.create({
    data: {
      email: input.email.trim().toLowerCase(),
      passwordHash,
      name: input.name,
      role: input.role,
      memberId: input.memberId || null,
    },
  });
}

/**
 * Member self-service account activation. A login can only be created by proving you are the
 * member on file: the membership number AND the email the Treasurer recorded for that member
 * must both match the same Member record. This is what stops a stranger from registering with
 * an arbitrary email — the pair has to match a real, existing membership. Rate-limited per
 * membership number, since it's otherwise an enumeration target (guess IDs, try known emails).
 */
export async function activateMemberAccount(input: { membershipNumber: string; email: string; password: string }) {
  const membershipNumber = input.membershipNumber.trim();
  const email = input.email.trim().toLowerCase();
  if (!membershipNumber) throw new Error("Enter your membership number.");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");

  const rateLimitKey = `activate:${membershipNumber.toLowerCase()}`;
  const limit = checkRateLimit(rateLimitKey, ACTIVATION_MAX_ATTEMPTS, ACTIVATION_WINDOW_MS);
  if (!limit.allowed) {
    throw new Error(`Too many attempts. Try again in ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minute(s), or contact your Treasurer.`);
  }

  const member = await db.member.findUnique({ where: { membershipNumber }, include: { user: true } });
  if (!member || !member.email || member.email.trim().toLowerCase() !== email) {
    throw new Error("No membership found matching that membership number and email. Contact your Treasurer.");
  }
  if (member.user) throw new Error("This membership already has a login. Try signing in, or contact your Treasurer to reset it.");

  const existingEmail = await db.user.findUnique({ where: { email } });
  if (existingEmail) throw new Error("An account with this email already exists. Try signing in instead.");

  resetRateLimit(rateLimitKey);
  return createUser({ email, password: input.password, name: member.fullName, role: "MEMBER", memberId: member.id });
}
