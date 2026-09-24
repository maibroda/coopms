import { db } from "@/lib/db";
import { num, round2, sum } from "@/lib/money";
import { addMonths, monthStart } from "@/lib/dates";
import { calcLoan, type RepaymentType } from "@/lib/calc";
import { totalSavings } from "./members";
import { logAudit } from "./auditLog";
import { getCachedSettings } from "./settings";
import { paginate, type Paginated } from "@/lib/pagination";
import type { Ctx } from "@/lib/auth/context";
import { can, ForbiddenError } from "@/lib/auth/permissions";

function requirePerm(ctx: Ctx, perm: "loan.view" | "loan.manage" | "self.request" | "approvals.manage") {
  if (!can(ctx.role, perm)) throw new ForbiddenError(perm);
}

export interface LoanInput {
  memberId: string;
  loanAmount: number;
  interestRate: number;
  durationMonths: number;
  repaymentType: RepaymentType;
  startMonth: string; // "YYYY-MM-01"
  note?: string | null;
  /**
   * When the amount exceeds the cooperative's configured eligibility cap, a reason here requests
   * an exception instead of being hard-declined. Ignored (no effect) when within the normal cap.
   */
  exceptionReason?: string | null;
}

export interface EligibilityResult {
  totalSavings: number;
  maxBorrowable: number;
  currentOutstandingPrincipal: number;
  availableToBorrow: number;
  eligible: boolean;
}

/**
 * A member may not owe (across active AND pending loans, principal terms) more than the
 * cooperative's configured eligibility multiplier (Admin-editable in Settings; 150% by
 * default) times their savings. Pending loans count too, so a member can't get around the cap
 * by stacking several requests before any of them is approved.
 */
export async function checkLoanEligibility(memberId: string, requestedAmount = 0): Promise<EligibilityResult> {
  const [savings, settings] = await Promise.all([totalSavings(memberId), getCachedSettings()]);
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });
  const openLoans = await db.loan.findMany({
    where: { memberId, status: { in: ["ACTIVE", "PENDING"] } },
    select: { loanAmount: true },
  });
  const currentOutstandingPrincipal = sum([num(member.openingLoanBalance), ...openLoans.map((l) => num(l.loanAmount))]);
  const maxBorrowable = round2(savings * settings.loanEligibilityMultiplier);
  const availableToBorrow = Math.max(round2(maxBorrowable - currentOutstandingPrincipal), 0);
  return {
    totalSavings: savings,
    maxBorrowable,
    currentOutstandingPrincipal,
    availableToBorrow,
    eligible: requestedAmount <= availableToBorrow,
  };
}

function buildLoanData(input: LoanInput) {
  if (input.loanAmount <= 0) throw new Error("Loan amount must be greater than zero.");
  if (input.durationMonths <= 0) throw new Error("Duration must be at least 1 month.");
  const calc = calcLoan(input.loanAmount, input.interestRate, input.durationMonths, input.repaymentType);
  const startMonth = new Date(input.startMonth);
  const endMonth = addMonths(startMonth, input.durationMonths - 1);
  return {
    memberId: input.memberId,
    loanAmount: input.loanAmount,
    interestRate: input.interestRate,
    repaymentType: input.repaymentType,
    durationMonths: input.durationMonths,
    startMonth,
    endMonth,
    totalInterest: calc.totalInterest,
    totalRepayment: calc.totalRepayment,
    monthlyRepayment: calc.monthlyRepayment,
    outstandingBalance: calc.totalRepayment,
    note: input.note || null,
  };
}

/**
 * Returns whether this request needs to be flagged as an exception. Throws only when the
 * request is over the cap AND no exception reason was given — the normal, non-negotiable path.
 * Over the cap WITH a reason is allowed through, but always as a flagged exception that forces
 * PENDING + Admin-only approval, never a silent bypass.
 */
async function resolveEligibility(input: LoanInput): Promise<{ isException: boolean }> {
  const eligibility = await checkLoanEligibility(input.memberId, input.loanAmount);
  if (eligibility.eligible) return { isException: false };
  if (!input.exceptionReason?.trim()) {
    throw new Error(
      `Loan declined: member can borrow at most ₦${eligibility.availableToBorrow.toLocaleString()} ` +
        `more (based on savings, less existing/pending loan principal). Requested ₦${input.loanAmount.toLocaleString()}. ` +
        `To proceed anyway, provide an exception reason.`,
    );
  }
  return { isException: true };
}

/**
 * Staff-facing loan creation (Treasurer/Admin picking the member). Admin-created loans go
 * straight to ACTIVE — an Admin approving their own action would be theater, since they
 * already hold every permission including approval. A Treasurer-created loan is the actual
 * maker-checker risk this exists for, so it starts PENDING and needs an Admin's sign-off
 * before it can be disbursed or appear on any deduction schedule.
 */
export async function createLoan(ctx: Ctx, input: LoanInput) {
  requirePerm(ctx, "loan.manage");
  const { isException } = await resolveEligibility(input);
  const data = buildLoanData(input);
  // Exceptions always require deliberate Admin review — never auto-approved, even for an Admin.
  const autoApprove = ctx.role === "ADMIN" && !isException;

  const loan = await db.loan.create({
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
    action: isException ? "LOAN_EXCEPTION_REQUESTED" : autoApprove ? "LOAN_CREATED_AUTO_APPROVED" : "LOAN_CREATED_PENDING",
    entityType: "Loan",
    entityId: loan.id,
    after: loan,
  });
  return loan;
}

/** Member self-service loan request — always lands PENDING for staff review. */
export async function requestLoan(ctx: Ctx, input: Omit<LoanInput, "memberId">) {
  requirePerm(ctx, "self.request");
  if (!ctx.memberId) throw new Error("Your account isn't linked to a membership record yet.");
  const full: LoanInput = { ...input, memberId: ctx.memberId };
  const { isException } = await resolveEligibility(full);
  const data = buildLoanData(full);
  const loan = await db.loan.create({
    data: { ...data, status: "PENDING", requestedById: ctx.userId, isExceptionRequest: isException, exceptionReason: isException ? input.exceptionReason!.trim() : null },
  });
  await logAudit(ctx, {
    action: isException ? "LOAN_EXCEPTION_REQUESTED" : "LOAN_REQUESTED_BY_MEMBER",
    entityType: "Loan",
    entityId: loan.id,
    after: loan,
  });
  return loan;
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
      throw new Error("A Treasurer-created loan needs Admin approval.");
    }
  }
}

export async function listPendingLoans(ctx: Ctx) {
  requirePerm(ctx, "approvals.manage");
  return db.loan.findMany({ where: { status: "PENDING" }, include: { member: true }, orderBy: { createdAt: "asc" } });
}

export async function approveLoan(ctx: Ctx, loanId: string) {
  const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
  if (loan.status !== "PENDING") throw new Error("Only pending loans can be approved.");
  await assertCanReview(ctx, loan.requestedById, loan.isExceptionRequest);
  if (!loan.isExceptionRequest) {
    // Re-check eligibility at approval time — savings/other loans may have moved since the
    // request. Skipped for exceptions, since exceeding the normal cap is the whole point.
    const eligibility = await checkLoanEligibility(loan.memberId, 0);
    const currentOutstandingWithoutThis = eligibility.currentOutstandingPrincipal - num(loan.loanAmount);
    if (currentOutstandingWithoutThis + num(loan.loanAmount) > eligibility.maxBorrowable) {
      throw new Error("This loan no longer fits the member's eligibility — reject it and ask them to re-request a smaller amount.");
    }
  }
  const updated = await db.loan.update({
    where: { id: loanId },
    data: { status: "ACTIVE", approvedById: ctx.userId, approvedAt: new Date() },
  });
  await logAudit(ctx, { action: "LOAN_APPROVED", entityType: "Loan", entityId: loanId, before: loan, after: updated });
  return updated;
}

export async function rejectLoan(ctx: Ctx, loanId: string, reason: string) {
  const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
  if (loan.status !== "PENDING") throw new Error("Only pending loans can be rejected.");
  await assertCanReview(ctx, loan.requestedById, loan.isExceptionRequest);
  const updated = await db.loan.update({
    where: { id: loanId },
    data: { status: "REJECTED", approvedById: ctx.userId, approvedAt: new Date(), rejectionReason: reason },
  });
  await logAudit(ctx, { action: "LOAN_REJECTED", entityType: "Loan", entityId: loanId, before: loan, after: updated });
  return updated;
}

/**
 * Restructures a loan: the old loan is frozen at status RESTRUCTURED (no more repayments are
 * ever collected against it — previewSchedule only looks at ACTIVE loans) and its remaining
 * outstandingBalance becomes the principal of a brand-new loan under the new terms. This is the
 * standard "same debt, new terms" pattern, not a rename of the old loan — the new loan gets its
 * own full amortization schedule from the new principal.
 *
 * Skips the eligibility cap: the member isn't borrowing more money, just changing terms on debt
 * they already owe, so re-running the savings-ratio check would be the wrong question here.
 */
export async function restructureLoan(
  ctx: Ctx,
  loanId: string,
  newTerms: { interestRate: number; durationMonths: number; repaymentType: RepaymentType; startMonth: string },
) {
  requirePerm(ctx, "loan.manage");
  const oldLoan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
  if (oldLoan.status !== "ACTIVE") throw new Error("Only active loans can be restructured.");
  if (num(oldLoan.outstandingBalance) <= 0) throw new Error("This loan has no remaining balance to restructure.");

  const newPrincipal = num(oldLoan.outstandingBalance);
  const data = buildLoanData({
    memberId: oldLoan.memberId,
    loanAmount: newPrincipal,
    interestRate: newTerms.interestRate,
    durationMonths: newTerms.durationMonths,
    repaymentType: newTerms.repaymentType,
    startMonth: newTerms.startMonth,
    note: `Restructured from loan ${oldLoan.id}.`,
  });

  const [, newLoan] = await db.$transaction([
    db.loan.update({ where: { id: loanId }, data: { status: "RESTRUCTURED" } }),
    db.loan.create({
      data: { ...data, status: "ACTIVE", requestedById: ctx.userId, approvedById: ctx.userId, approvedAt: new Date(), restructuredFromLoanId: loanId },
    }),
  ]);

  await logAudit(ctx, {
    action: "LOAN_RESTRUCTURED",
    entityType: "Loan",
    entityId: loanId,
    before: { status: oldLoan.status, outstandingBalance: oldLoan.outstandingBalance },
    after: { status: "RESTRUCTURED", newLoanId: newLoan.id, newPrincipal },
  });
  return newLoan;
}

export async function listLoans(ctx: Ctx, opts: { memberId?: string; status?: string } = {}) {
  requirePerm(ctx, "loan.view");
  return db.loan.findMany({
    where: { memberId: opts.memberId, status: opts.status as any },
    include: { member: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listLoansPaginated(
  ctx: Ctx,
  opts: { memberId?: string; status?: string; page: number; pageSize: number },
): Promise<Paginated<Awaited<ReturnType<typeof listLoans>>[number]>> {
  requirePerm(ctx, "loan.view");
  const where = { memberId: opts.memberId, status: opts.status as any };
  const [items, total] = await Promise.all([
    db.loan.findMany({ where, include: { member: true }, orderBy: { createdAt: "desc" }, skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize }),
    db.loan.count({ where }),
  ]);
  return paginate(items, total, opts.page, opts.pageSize);
}

export async function suspendLoan(ctx: Ctx, loanId: string, from: string, until: string) {
  requirePerm(ctx, "loan.manage");
  return db.loan.update({
    where: { id: loanId },
    data: { suspendedFrom: new Date(from), suspendedUntil: new Date(until) },
  });
}

export async function resumeLoan(ctx: Ctx, loanId: string) {
  requirePerm(ctx, "loan.manage");
  return db.loan.update({ where: { id: loanId }, data: { suspendedFrom: null, suspendedUntil: null } });
}

// RESTRUCTURED is set only via restructureLoan(), which gives it real new-terms behavior —
// not offered here, so a loan can't be waved into that status with nothing behind it.
export async function markLoanStatus(ctx: Ctx, loanId: string, status: "DEFAULTED" | "ACTIVE") {
  requirePerm(ctx, "loan.manage");
  return db.loan.update({ where: { id: loanId }, data: { status } });
}

/**
 * A member's direct/lump-sum payment into the cooperative's account, applied straight to the
 * loan balance (source MANUAL) rather than through the payroll schedule. Caps at the
 * outstanding balance and completes the loan early if it's paid off — the borrower keeps
 * whatever interest was still scheduled on periods that now never happen, which is the correct
 * outcome for both FLAT and REDUCING loans since outstandingBalance already represents the
 * full remaining obligation, not just principal.
 */
export async function recordManualLoanRepayment(
  ctx: Ctx,
  loanId: string,
  input: { amount: number; paidOn: string; reference?: string | null },
) {
  requirePerm(ctx, "loan.manage");
  if (input.amount <= 0) throw new Error("Amount must be greater than zero.");
  const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
  if (loan.status !== "ACTIVE") throw new Error("Only active loans can receive a repayment.");

  const applied = Math.min(round2(input.amount), num(loan.outstandingBalance));
  const balanceAfter = round2(num(loan.outstandingBalance) - applied);
  const month = monthStart(new Date(input.paidOn).getUTCFullYear(), new Date(input.paidOn).getUTCMonth() + 1);

  const [repayment] = await db.$transaction([
    db.loanRepayment.create({
      data: {
        loanId,
        month,
        amount: applied,
        principal: applied,
        interest: 0,
        balanceAfter,
        source: "MANUAL",
        reference: input.reference || null,
        recordedById: ctx.userId,
      },
    }),
    db.loan.update({
      where: { id: loanId },
      data: { outstandingBalance: balanceAfter, status: balanceAfter <= 0 ? "COMPLETED" : loan.status },
    }),
  ]);

  await logAudit(ctx, {
    action: "LOAN_MANUAL_REPAYMENT",
    entityType: "Loan",
    entityId: loanId,
    before: { outstandingBalance: loan.outstandingBalance },
    after: { outstandingBalance: balanceAfter, amountApplied: applied },
  });
  return repayment;
}
