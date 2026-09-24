import { db } from "@/lib/db";
import { num, round2 } from "@/lib/money";
import { logAudit } from "./auditLog";
import type { Ctx } from "@/lib/auth/context";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import type { RepaymentType } from "@/lib/calc";

function requireSettingsManage(ctx: Ctx) {
  if (!can(ctx.role, "settings.manage")) throw new ForbiddenError("settings.manage");
}

export interface Settings {
  id: string;
  orgName: string;
  logoUrl: string | null;
  currencySymbol: string;
  loanEligibilityMultiplier: number;
}

/**
 * There is exactly one settings row. Fetched by "the only row that exists" rather than a fixed
 * id, and created with defaults on first read if the table is still empty.
 */
export async function getSettings(): Promise<Settings> {
  const existing = await db.cooperativeSettings.findFirst();
  const row = existing ?? (await db.cooperativeSettings.create({ data: {} }));
  return {
    id: row.id,
    orgName: row.orgName,
    logoUrl: row.logoUrl,
    currencySymbol: row.currencySymbol,
    loanEligibilityMultiplier: num(row.loanEligibilityMultiplier),
  };
}

/** Cached per server process — settings change rarely and this app is single-tenant, so a
 * short-lived in-memory cache avoids hitting the DB on every eligibility check without risking
 * cross-tenant staleness (there is only one cooperative per deployment). */
let cached: { value: Settings; at: number } | null = null;
const CACHE_MS = 30_000;

export async function getCachedSettings(): Promise<Settings> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const value = await getSettings();
  cached = { value, at: Date.now() };
  return value;
}

export async function updateSettings(
  ctx: Ctx,
  input: { orgName: string; logoUrl?: string | null; currencySymbol: string; loanEligibilityMultiplier: number },
) {
  requireSettingsManage(ctx);
  if (!input.orgName.trim()) throw new Error("Organization name is required.");
  if (!input.currencySymbol.trim()) throw new Error("Currency symbol is required.");
  if (input.loanEligibilityMultiplier <= 0) throw new Error("Eligibility multiplier must be greater than zero.");

  const before = await getSettings();
  const row = await db.cooperativeSettings.upsert({
    where: { id: before.id },
    create: {
      orgName: input.orgName.trim(),
      logoUrl: input.logoUrl || null,
      currencySymbol: input.currencySymbol.trim(),
      loanEligibilityMultiplier: round2(input.loanEligibilityMultiplier),
      updatedById: ctx.userId,
    },
    update: {
      orgName: input.orgName.trim(),
      logoUrl: input.logoUrl || null,
      currencySymbol: input.currencySymbol.trim(),
      loanEligibilityMultiplier: round2(input.loanEligibilityMultiplier),
      updatedById: ctx.userId,
    },
  });
  cached = null; // invalidate

  await logAudit(ctx, {
    action: "SETTINGS_UPDATED",
    entityType: "CooperativeSettings",
    entityId: row.id,
    before,
    after: { orgName: row.orgName, currencySymbol: row.currencySymbol, loanEligibilityMultiplier: num(row.loanEligibilityMultiplier) },
  });
  return row;
}

export interface LoanProductInput {
  name: string;
  interestRate: number;
  durationMonths: number;
  repaymentType: RepaymentType;
}

export async function listLoanProducts(activeOnly = true) {
  return db.loanProduct.findMany({ where: activeOnly ? { isActive: true } : undefined, orderBy: { name: "asc" } });
}

export async function createLoanProduct(ctx: Ctx, input: LoanProductInput) {
  requireSettingsManage(ctx);
  if (!input.name.trim()) throw new Error("Product name is required.");
  if (input.durationMonths <= 0) throw new Error("Duration must be at least 1 month.");
  const product = await db.loanProduct.create({
    data: { name: input.name.trim(), interestRate: input.interestRate, durationMonths: input.durationMonths, repaymentType: input.repaymentType },
  });
  await logAudit(ctx, { action: "LOAN_PRODUCT_CREATED", entityType: "LoanProduct", entityId: product.id, after: product });
  return product;
}

export async function setLoanProductActive(ctx: Ctx, id: string, isActive: boolean) {
  requireSettingsManage(ctx);
  const product = await db.loanProduct.update({ where: { id }, data: { isActive } });
  await logAudit(ctx, { action: isActive ? "LOAN_PRODUCT_ACTIVATED" : "LOAN_PRODUCT_DEACTIVATED", entityType: "LoanProduct", entityId: id, after: product });
  return product;
}
