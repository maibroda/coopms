export type Role = "ADMIN" | "TREASURER" | "MEMBER";

export const PERMISSIONS = [
  "dashboard.view",
  "member.view",
  "member.manage",
  "contribution.view",
  "contribution.manage",
  "loan.view",
  "loan.manage",
  "sale.view",
  "sale.manage",
  "schedule.view",
  "schedule.post",
  "reports.view",
  "settings.manage",
  "users.manage",
  "self.view",
  "self.request",
  "approvals.manage",
  "payments.manage",
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ALL,
  TREASURER: [
    "dashboard.view",
    "member.view",
    "member.manage",
    "contribution.view",
    "contribution.manage",
    "loan.view",
    "loan.manage",
    "sale.view",
    "sale.manage",
    "schedule.view",
    "schedule.post",
    "reports.view",
    "approvals.manage",
    "payments.manage",
    "audit.view",
  ],
  MEMBER: ["self.view", "self.request"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Where to send a signed-in user by default — members land on their own statement. */
export function landingPath(role: Role): string {
  return role === "MEMBER" ? "/me" : "/dashboard";
}

export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`You do not have permission to perform this action (${permission}).`);
    this.name = "ForbiddenError";
  }
}
