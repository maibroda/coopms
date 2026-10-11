import { db } from "@/lib/db";
import { num, round2, sum } from "@/lib/money";
import { logAudit } from "./auditLog";
import { getSettings } from "./settings";
import { paginate } from "@/lib/pagination";
import type { Ctx } from "@/lib/auth/context";
import { can, ForbiddenError } from "@/lib/auth/permissions";

function requireView(ctx: Ctx) {
  if (!can(ctx.role, "dividend.view")) throw new ForbiddenError("dividend.view");
}

function requireManage(ctx: Ctx) {
  if (!can(ctx.role, "dividend.manage")) throw new ForbiddenError("dividend.manage");
}

/**
 * coopms has no general ledger — no expense tracking, no trading account — so it cannot derive
 * a year's surplus itself. `declaredSurplus` is the audited figure an Admin brings in from
 * wherever the cooperative's real bookkeeping happens; everything downstream (appropriation,
 * dividend pools, the per-member split) is computed from that single input plus data coopms
 * already has natively: member savings (Contribution) and loan repayments (LoanRepayment).
 */
export async function declareOrRecomputeDraft(ctx: Ctx, input: { year: number; declaredSurplus: number }) {
  requireManage(ctx);
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    throw new Error("Enter a valid financial year.");
  }
  if (!(input.declaredSurplus > 0)) {
    throw new Error("Declared surplus must be greater than zero.");
  }

  const existing = await db.surplusDeclaration.findUnique({ where: { year: input.year } });
  if (existing && existing.status === "APPROVED") {
    throw new Error(`${input.year}'s dividend declaration is already approved and locked. Approved declarations cannot be recomputed.`);
  }

  const settings = await getSettings();
  const declaredSurplus = round2(input.declaredSurplus);

  const reserveFundAmount = round2(declaredSurplus * settings.reserveFundRate);
  const educationFundAmount = round2(declaredSurplus * settings.educationFundRate);
  const dividendAmount = round2(declaredSurplus * settings.dividendRate);
  const honorariumAmount = round2(declaredSurplus * settings.honorariumRate);
  const meetingExpensesAmount = round2(declaredSurplus * settings.meetingExpensesRate);

  const dividendSavingsPool = round2(dividendAmount * settings.dividendSavingsRatio);
  const dividendRepaymentPool = round2(dividendAmount * settings.dividendRepaymentRatio);

  const yearStart = new Date(Date.UTC(input.year, 0, 1));
  const yearEnd = new Date(Date.UTC(input.year, 11, 31));

  const [members, repaymentRows] = await Promise.all([
    db.member.findMany({
      select: { id: true, openingSavingsBalance: true, contributions: { where: { month: { lte: yearEnd } }, select: { amount: true } } },
    }),
    db.loanRepayment.findMany({
      where: { month: { gte: yearStart, lte: yearEnd } },
      select: { amount: true, loan: { select: { memberId: true } } },
    }),
  ]);

  const repaymentsByMember = new Map<string, number>();
  for (const r of repaymentRows) {
    const memberId = r.loan.memberId;
    repaymentsByMember.set(memberId, (repaymentsByMember.get(memberId) ?? 0) + num(r.amount));
  }

  const perMember = members.map((m) => {
    const eligibleSavings = round2(num(m.openingSavingsBalance) + sum(m.contributions.map((c) => num(c.amount))));
    const eligibleRepayments = round2(repaymentsByMember.get(m.id) ?? 0);
    return { memberId: m.id, eligibleSavings, eligibleRepayments };
  });

  const totalEligibleSavings = round2(sum(perMember.map((m) => m.eligibleSavings)));
  const totalEligibleRepayments = round2(sum(perMember.map((m) => m.eligibleRepayments)));

  const allocations = perMember.map((m) => {
    const savingsDividend =
      totalEligibleSavings > 0 ? round2((dividendSavingsPool * m.eligibleSavings) / totalEligibleSavings) : 0;
    const repaymentDividend =
      totalEligibleRepayments > 0 ? round2((dividendRepaymentPool * m.eligibleRepayments) / totalEligibleRepayments) : 0;
    return {
      memberId: m.memberId,
      eligibleSavings: m.eligibleSavings,
      eligibleRepayments: m.eligibleRepayments,
      savingsDividend,
      repaymentDividend,
      totalDividend: round2(savingsDividend + repaymentDividend),
    };
  });

  const sumRepaymentDividends = round2(sum(allocations.map((a) => a.repaymentDividend)));
  const unallocatedRepaymentPool = round2(dividendRepaymentPool - sumRepaymentDividends);

  const declaration = await db.$transaction(async (tx) => {
    if (existing) {
      await tx.dividendAllocation.deleteMany({ where: { declarationId: existing.id } });
      await tx.surplusDeclaration.delete({ where: { id: existing.id } });
    }
    return tx.surplusDeclaration.create({
      data: {
        year: input.year,
        declaredSurplus,
        reserveFundRate: settings.reserveFundRate,
        educationFundRate: settings.educationFundRate,
        dividendRate: settings.dividendRate,
        honorariumRate: settings.honorariumRate,
        meetingExpensesRate: settings.meetingExpensesRate,
        dividendSavingsRatio: settings.dividendSavingsRatio,
        dividendRepaymentRatio: settings.dividendRepaymentRatio,
        reserveFundAmount,
        educationFundAmount,
        dividendAmount,
        honorariumAmount,
        meetingExpensesAmount,
        dividendSavingsPool,
        dividendRepaymentPool,
        totalEligibleSavings,
        totalEligibleRepayments,
        unallocatedRepaymentPool,
        declaredById: ctx.userId,
        allocations: { create: allocations },
      },
    });
  });

  await logAudit(ctx, {
    action: existing ? "DIVIDEND_DECLARATION_RECOMPUTED" : "DIVIDEND_DECLARATION_CREATED",
    entityType: "SurplusDeclaration",
    entityId: declaration.id,
    after: {
      year: declaration.year,
      declaredSurplus,
      dividendAmount,
      dividendSavingsPool,
      dividendRepaymentPool,
      unallocatedRepaymentPool,
      memberCount: allocations.length,
    },
  });

  return declaration;
}

export async function approveDeclaration(ctx: Ctx, id: string) {
  requireManage(ctx);
  const declaration = await db.surplusDeclaration.findUniqueOrThrow({ where: { id } });
  if (declaration.status === "APPROVED") throw new Error("This declaration is already approved.");

  const updated = await db.surplusDeclaration.update({
    where: { id },
    data: { status: "APPROVED", approvedById: ctx.userId, approvedAt: new Date() },
  });

  await logAudit(ctx, {
    action: "DIVIDEND_DECLARATION_APPROVED",
    entityType: "SurplusDeclaration",
    entityId: id,
    before: { status: declaration.status },
    after: { status: "APPROVED", year: declaration.year, declaredSurplus: num(declaration.declaredSurplus) },
  });
  return updated;
}

/** Only a DRAFT declaration can be abandoned outright — an APPROVED one is a locked record. */
export async function deleteDraftDeclaration(ctx: Ctx, id: string) {
  requireManage(ctx);
  const declaration = await db.surplusDeclaration.findUniqueOrThrow({ where: { id } });
  if (declaration.status === "APPROVED") throw new Error("Approved declarations cannot be deleted.");
  await db.surplusDeclaration.delete({ where: { id } });
  await logAudit(ctx, {
    action: "DIVIDEND_DECLARATION_DELETED",
    entityType: "SurplusDeclaration",
    entityId: id,
    before: { year: declaration.year, declaredSurplus: num(declaration.declaredSurplus) },
  });
}

export async function listDeclarations(ctx: Ctx) {
  requireView(ctx);
  return db.surplusDeclaration.findMany({
    orderBy: { year: "desc" },
    include: { _count: { select: { allocations: true } } },
  });
}

export async function getDeclaration(ctx: Ctx, id: string) {
  requireView(ctx);
  return db.surplusDeclaration.findUniqueOrThrow({ where: { id } });
}

/** A member's own approved dividend history — DRAFT declarations are internal working figures
 * and never shown to the member they belong to. */
export async function getMyDividendHistory(ctx: Ctx) {
  if (!can(ctx.role, "self.view")) throw new ForbiddenError("self.view");
  if (!ctx.memberId) return [];
  return db.dividendAllocation.findMany({
    where: { memberId: ctx.memberId, declaration: { status: "APPROVED" } },
    include: { declaration: { select: { year: true, approvedAt: true } } },
    orderBy: { declaration: { year: "desc" } },
  });
}

export async function listAllocations(ctx: Ctx, declarationId: string, opts: { page: number; pageSize: number }) {
  requireView(ctx);
  const [items, total] = await Promise.all([
    db.dividendAllocation.findMany({
      where: { declarationId },
      include: { member: { select: { membershipNumber: true, fullName: true } } },
      orderBy: { totalDividend: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    db.dividendAllocation.count({ where: { declarationId } }),
  ]);
  return paginate(items, total, opts.page, opts.pageSize);
}
