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
  productSalesOpen: boolean;
  reserveFundRate: number;
  educationFundRate: number;
  dividendRate: number;
  honorariumRate: number;
  meetingExpensesRate: number;
  dividendSavingsRatio: number;
  dividendRepaymentRatio: number;
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
    productSalesOpen: row.productSalesOpen,
    reserveFundRate: num(row.reserveFundRate),
    educationFundRate: num(row.educationFundRate),
    dividendRate: num(row.dividendRate),
    honorariumRate: num(row.honorariumRate),
    meetingExpensesRate: num(row.meetingExpensesRate),
    dividendSavingsRatio: num(row.dividendSavingsRatio),
    dividendRepaymentRatio: num(row.dividendRepaymentRatio),
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

/**
 * Opens or closes the Product Sales window — Admin-only, deliberately a one-click toggle
 * separate from the general settings form since it's expected to be flipped at the start/end of
 * each sales period (e.g. the festive season) rather than edited alongside org-wide policy.
 * While closed, neither a member's purchase request nor a staff-created sale can go through.
 */
export async function setProductSalesOpen(ctx: Ctx, open: boolean) {
  if (ctx.role !== "ADMIN") throw new ForbiddenError("settings.manage");
  const before = await getSettings();
  const row = await db.cooperativeSettings.upsert({
    where: { id: before.id },
    create: { productSalesOpen: open, updatedById: ctx.userId },
    update: { productSalesOpen: open, updatedById: ctx.userId },
  });
  cached = null;

  await logAudit(ctx, {
    action: open ? "PRODUCT_SALES_OPENED" : "PRODUCT_SALES_CLOSED",
    entityType: "CooperativeSettings",
    entityId: row.id,
    before: { productSalesOpen: before.productSalesOpen },
    after: { productSalesOpen: row.productSalesOpen },
  });
  return row;
}

export interface AppropriationRatesInput {
  reserveFundRate: number;
  educationFundRate: number;
  dividendRate: number;
  honorariumRate: number;
  meetingExpensesRate: number;
  dividendSavingsRatio: number;
  dividendRepaymentRatio: number;
}

const RATE_SUM_TOLERANCE = 0.0005; // guards against float noise, not real policy drift

/**
 * The five appropriation rates (reserve/education/dividend/honorarium/meeting) must sum to
 * 100% of surplus, and the dividend pool's own savings/repayment split must sum to 100% of
 * the dividend — both checked here rather than at declaration time, so a bad policy edit is
 * caught immediately instead of silently producing an unbalanced declaration months later.
 */
export async function setAppropriationRates(ctx: Ctx, input: AppropriationRatesInput) {
  requireSettingsManage(ctx);
  const appropriationSum =
    input.reserveFundRate + input.educationFundRate + input.dividendRate + input.honorariumRate + input.meetingExpensesRate;
  if (Math.abs(appropriationSum - 1) > RATE_SUM_TOLERANCE) {
    throw new Error(`Reserve + Education + Dividend + Honorarium + Meeting rates must sum to 100% (currently ${(appropriationSum * 100).toFixed(2)}%).`);
  }
  const dividendSplitSum = input.dividendSavingsRatio + input.dividendRepaymentRatio;
  if (Math.abs(dividendSplitSum - 1) > RATE_SUM_TOLERANCE) {
    throw new Error(`Savings + Loan repayment allocation ratios must sum to 100% (currently ${(dividendSplitSum * 100).toFixed(2)}%).`);
  }
  for (const [label, v] of Object.entries(input)) {
    if (v < 0) throw new Error(`${label} cannot be negative.`);
  }

  const before = await getSettings();
  const row = await db.cooperativeSettings.upsert({
    where: { id: before.id },
    create: { ...input, updatedById: ctx.userId },
    update: { ...input, updatedById: ctx.userId },
  });
  cached = null;

  await logAudit(ctx, {
    action: "APPROPRIATION_RATES_UPDATED",
    entityType: "CooperativeSettings",
    entityId: row.id,
    before: {
      reserveFundRate: before.reserveFundRate,
      educationFundRate: before.educationFundRate,
      dividendRate: before.dividendRate,
      honorariumRate: before.honorariumRate,
      meetingExpensesRate: before.meetingExpensesRate,
      dividendSavingsRatio: before.dividendSavingsRatio,
      dividendRepaymentRatio: before.dividendRepaymentRatio,
    },
    after: input,
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
