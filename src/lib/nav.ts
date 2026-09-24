import type { Permission } from "@/lib/auth/permissions";

export interface NavItem {
  href: string;
  label: string;
  perm: Permission;
}

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", perm: "dashboard.view" },
  { href: "/approvals", label: "Approvals", perm: "approvals.manage" },
  { href: "/members", label: "Members", perm: "member.view" },
  { href: "/loans", label: "Loans", perm: "loan.view" },
  { href: "/sales", label: "Product Sales", perm: "sale.view" },
  { href: "/schedule", label: "Deduction Schedule", perm: "schedule.view" },
  { href: "/reports", label: "Reports", perm: "reports.view" },
  { href: "/audit-log", label: "Audit Log", perm: "audit.view" },
  { href: "/settings/organization", label: "Organization Settings", perm: "settings.manage" },
  { href: "/settings/api-keys", label: "API / ERP Integration", perm: "settings.manage" },
];

export const SELF_NAV: NavItem[] = [{ href: "/me", label: "My Statement", perm: "self.view" }];
