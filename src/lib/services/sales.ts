import { db } from "@/lib/db";
import { num, round2, sum } from "@/lib/money";
import { addMonths, monthStart } from "@/lib/dates";
import { calcProductSale } from "@/lib/calc";
import { totalSavings } from "./members";
import { logAudit } from "./auditLog";
import { paginate, type Paginated } from "@/lib/pagination";
import type { Ctx } from "@/lib/auth/context";
import { can, ForbiddenError } from "@/lib/auth/permissions";

function requirePerm(ctx: Ctx, perm: "sale.view" | "sale.manage" | "self.request" | "approvals.manage") {
  if (!can(ctx.role, perm)) throw new ForbiddenError(perm);
}

export interface SaleInput {
  memberId: string;
  itemName: string;
  category: "PHONE" | "LAPTOP" | "FOOD" | "APPLIANCE" | "OTHER";
  cost: number;
  interestRate: number;
  durationMonths: number;
  startMonth: string;
  /** Requests an exception when cost exceeds savings capacity; ignored if within capacity. */
  exceptionReason?: string | null;
}

export interface PurchaseEligibility {
  totalSavings: number;
  outstandingPurchases: number;
  availableCapacity: number;
  eligible: boolean;
}

/** Purchases on credit (active AND pending) may not, in total, exceed the member's savings. */
export async function checkPurchaseEligibility(memberId: string, requestedCost = 0): Promise<PurchaseEligibility> {
  const savings = await totalSavings(memberId);
  const openSales = await db.productSale.findMany({
    where: { memberId, status: { in: ["ACTIVE", "PENDING"] } },
    select: { outstandingBalance: true },
  });
  const outstandingPurchases = sum(openSales.map((s) => num(s.outstandingBalance)));
  const availableCapacity = Math.max(round2(savings - outstandingPurchases), 0);
  return { totalSavings: savings, outstandingPurchases, availableCapacity, eligible: requestedCost <= availableCapacity };
}

function buildSaleData(input: SaleInput) {
  if (input.cost <= 0) throw new Error("Item cost must be greater than zero.");
  if (input.durationMonths <= 0) throw new Error("Duration must be at least 1 month.");
  const calc = calcProductSale(input.cost, input.interestRate, input.durationMonths);
  const startMonth = new Date(input.startMonth);
  const endMonth = addMonths(startMonth, input.durationMonths - 1);
  return {
    memberId: input.memberId,
    itemName: input.itemName,
    category: input.category,
    cost: input.cost,
    interestRate: input.interestRate,
    durationMonths: input.durationMonths,
    startMonth,
    endMonth,
    totalInterest: calc.totalInterest,
    totalRepayment: calc.totalRepayment,
    monthlyDeduction: calc.monthlyRepayment,
    outstandingBalance: calc.totalRepayment,
  };
}

async function resolveEligibility(input: SaleInput): Promise<{ isException: boolean }> {
  const eligibility = await checkPurchaseEligibility(input.memberId, input.cost);
  if (eligibility.eligible) return { isException: false };
  if (!input.exceptionReason?.trim()) {
    throw new Error(
      `Purchase declined: member's savings can only accommodate ₦${eligibility.availableCapacity.toLocaleString()} ` +
        `more in credit purchases (existing + pending). Item costs ₦${input.cost.toLocaleString()}. ` +
        `To proceed anyway, provide an exception reason.`,
    );
  }
  return { isException: true };
}

/** Staff-facing purchase creation — same auto-approve-if-Admin rule as createLoan. */
export async function createSale(ctx: Ctx, input: SaleInput) {
  requirePerm(ctx, "sale.manage");
  const { isException } = await resolveEligibility(input);
  const data = buildSaleData(input);
  const autoApprove = ctx.role === "ADMIN" && !isException;

  const sale = await db.productSale.create({
    data: {
      ...data,
      status: autoApprove ? "ACTIVE" : "PENDING",
      requestedById: ctx.userId,
      isExceptionRequest: isException,
      exceptionReason: isException ? input.exceptionReason!.trim() : null,
      ...(autoApprove ? { approvedById: ctx.userId, approvedAt: new Date() } : {}),
    },
  });
  await logAudit(ctx, {
    action: isException ? "SALE_EXCEPTION_REQUESTED" : autoApprove ? "SALE_CREATED_AUTO_APPROVED" : "SALE_CREATED_PENDING",
    entityType: "ProductSale",
    entityId: sale.id,
    after: sale,
  });
  return sale;
}

/** Member self-service purchase request — always lands PENDING for staff review. */
export async function requestSale(ctx: Ctx, input: Omit<SaleInput, "memberId">) {
  requirePerm(ctx, "self.request");
  if (!ctx.memberId) throw new Error("Your account isn't linked to a membership record yet.");
  const full: SaleInput = { ...input, memberId: ctx.memberId };
  const { isException } = await resolveEligibility(full);
  const data = buildSaleData(full);
  const sale = await db.productSale.create({
    data: { ...data, status: "PENDING", requestedById: ctx.userId, isExceptionRequest: isException, exceptionReason: isException ? input.exceptionReason!.trim() : null },
  });
  await logAudit(ctx, {
    action: isException ? "SALE_EXCEPTION_REQUESTED" : "SALE_REQUESTED_BY_MEMBER",
    entityType: "ProductSale",
    entityId: sale.id,
    after: sale,
  });
  return sale;
}

async function assertCanReview(ctx: Ctx, requestedById: string | null, isExceptionRequest = false) {
  requirePerm(ctx, "approvals.manage");
  if (requestedById === ctx.userId) throw new Error("You can't approve or reject your own request — ask another Admin or Treasurer.");
  if (isExceptionRequest && ctx.role !== "ADMIN") {
    throw new Error("This is an exception to the standard eligibility cap — only an Admin can approve or reject it.");
  }
  if (requestedById) {
    const requester = await db.user.findUnique({ where: { id: requestedById } });
    if (requester?.role === "TREASURER" && ctx.role !== "ADMIN") {
      throw new Error("A Treasurer-created purchase needs Admin approval.");
    }
  }
}

export async function listPendingSales(ctx: Ctx) {
  requirePerm(ctx, "approvals.manage");
  return db.productSale.findMany({ where: { status: "PENDING" }, include: { member: true }, orderBy: { createdAt: "asc" } });
}

export async function approveSale(ctx: Ctx, saleId: string) {
  const sale = await db.productSale.findUniqueOrThrow({ where: { id: saleId } });
  if (sale.status !== "PENDING") throw new Error("Only pending purchases can be approved.");
  await assertCanReview(ctx, sale.requestedById, sale.isExceptionRequest);
  const updated = await db.productSale.update({
    where: { id: saleId },
    data: { status: "ACTIVE", approvedById: ctx.userId, approvedAt: new Date() },
  });
  await logAudit(ctx, { action: "SALE_APPROVED", entityType: "ProductSale", entityId: saleId, before: sale, after: updated });
  return updated;
}

export async function rejectSale(ctx: Ctx, saleId: string, reason: string) {
  const sale = await db.productSale.findUniqueOrThrow({ where: { id: saleId } });
  if (sale.status !== "PENDING") throw new Error("Only pending purchases can be rejected.");
  await assertCanReview(ctx, sale.requestedById, sale.isExceptionRequest);
  const updated = await db.productSale.update({
    where: { id: saleId },
    data: { status: "REJECTED", approvedById: ctx.userId, approvedAt: new Date(), rejectionReason: reason },
  });
  await logAudit(ctx, { action: "SALE_REJECTED", entityType: "ProductSale", entityId: saleId, before: sale, after: updated });
  return updated;
}

export async function listSales(ctx: Ctx, opts: { memberId?: string; status?: string } = {}) {
  requirePerm(ctx, "sale.view");
  return db.productSale.findMany({
    where: { memberId: opts.memberId, status: opts.status as any },
    include: { member: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listSalesPaginated(
  ctx: Ctx,
  opts: { memberId?: string; status?: string; page: number; pageSize: number },
): Promise<Paginated<Awaited<ReturnType<typeof listSales>>[number]>> {
  requirePerm(ctx, "sale.view");
  const where = { memberId: opts.memberId, status: opts.status as any };
  const [items, total] = await Promise.all([
    db.productSale.findMany({ where, include: { member: true }, orderBy: { createdAt: "desc" }, skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize }),
    db.productSale.count({ where }),
  ]);
  return paginate(items, total, opts.page, opts.pageSize);
}

/**
 * Records a member's direct payment (cash/bank transfer) against a product purchase — the only
 * way purchases are ever repaid, since they're deliberately excluded from the payroll schedule.
 * Fixes the previous version of this app, where ProductRepayment existed in the schema but
 * nothing ever wrote to it, so outstandingBalance never moved no matter what a member paid.
 */
export async function recordSaleRepayment(
  ctx: Ctx,
  saleId: string,
  input: { amount: number; paidOn: string; reference?: string | null },
) {
  requirePerm(ctx, "sale.manage");
  if (input.amount <= 0) throw new Error("Amount must be greater than zero.");
  const sale = await db.productSale.findUniqueOrThrow({ where: { id: saleId } });
  if (sale.status !== "ACTIVE") throw new Error("Only active purchases can receive a repayment.");

  const applied = Math.min(round2(input.amount), num(sale.outstandingBalance));
  const balanceAfter = round2(num(sale.outstandingBalance) - applied);
  const month = monthStart(new Date(input.paidOn).getUTCFullYear(), new Date(input.paidOn).getUTCMonth() + 1);

  const [repayment] = await db.$transaction([
    db.productRepayment.create({
      data: { saleId, month, amount: applied, balanceAfter, reference: input.reference || null, recordedById: ctx.userId },
    }),
    db.productSale.update({
      where: { id: saleId },
      data: { outstandingBalance: balanceAfter, status: balanceAfter <= 0 ? "COMPLETED" : sale.status },
    }),
  ]);

  await logAudit(ctx, {
    action: "SALE_REPAYMENT",
    entityType: "ProductSale",
    entityId: saleId,
    before: { outstandingBalance: sale.outstandingBalance },
    after: { outstandingBalance: balanceAfter, amountApplied: applied },
  });
  return repayment;
}
