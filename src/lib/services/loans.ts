import { db } from "@/lib/db";
import { num, round2, sum } from "@/lib/money";
import { addMonths, monthStart, monthsBetween } from "@/lib/dates";
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
  /** True when the member hasn't yet completed the minimum tenure to borrow (still eligible to
   * buy on credit via product sales — this restriction is loans-only). */
  tooNewToBorrow: boolean;
}

const MIN_MONTHS_BEFORE_BORROWING = 6;

/**
 * A member may not owe (across active AND pending loans, principal terms) more than the
 * cooperative's configured eligibility multiplier (Admin-editable in Settings; 150% by
 * default) times their savings. Pending loans count too, so a member can't get around the cap
 * by stacking several requests before any of them is approved.
 *
 * A member also can't borrow at all until they've been a member for at least 6 months — new
 * joiners can still buy on credit via product sales, which has its own separate eligibility
 * check that doesn't apply this tenure restriction.
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
  const tooNewToBorrow = monthsBetween(member.dateJoined, new Date()) < MIN_MONTHS_BEFORE_BORROWING;
  return {
    totalSavings: savings,
    maxBorrowable,
    currentOutstandingPrincipal,
    availableToBorrow,
    eligible: !tooNewToBorrow && requestedAmount <= availableToBorrow,
    tooNewToBorrow,
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
  // Hard rule, no exception path — a member under 6 months' tenure can't borrow at all yet,
  // regardless of how small the request or how strong the reason given.
  if (eligibility.tooNewToBorrow) {
    throw new Error(
      `Loan declined: this member joined less than ${MIN_MONTHS_BEFORE_BORROWING} months ago and isn't yet eligible to borrow. ` +
        `They can still make purchases on credit in the meantime.`,
    );
  }
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

/**
 * Admin-only direct correction of an applied loan's terms — unlike restructureLoan (which
 * creates a brand-new loan under new terms for genuinely renegotiated debt), this is an in-place
 * fix for a loan whose amount/rate/duration/start was simply entered wrong. Recomputes the full
 * amortization from the corrected terms, then nets off whatever has already been repaid so the
 * member isn't charged twice for payments already collected. Skips the eligibility cap for the
 * same reason restructuring does — this corrects a record, it isn't a new lending decision.
 */
export async function adjustLoan(
  ctx: Ctx,
  loanId: string,
  newTerms: { loanAmount: number; interestRate: number; durationMonths: number; repaymentType: RepaymentType; startMonth: string },
) {
  if (ctx.role !== "ADMIN") throw new ForbiddenError("loan.manage");
  const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
  if (loan.status !== "ACTIVE" && loan.status !== "PENDING") {
    throw new Error("Only active or pending loans can be adjusted — restructure a completed/defaulted loan instead if needed.");
  }

  const paidAgg = await db.loanRepayment.aggregate({ where: { loanId }, _sum: { amount: true } });
  const totalPaid = num(paidAgg._sum.amount ?? 0);

  const data = buildLoanData({
    memberId: loan.memberId,
    loanAmount: newTerms.loanAmount,
    interestRate: newTerms.interestRate,
    durationMonths: newTerms.durationMonths,
    repaymentType: newTerms.repaymentType,
    startMonth: newTerms.startMonth,
    note: loan.note,
  });
  const newOutstanding = Math.max(round2(data.totalRepayment - totalPaid), 0);

  const updated = await db.loan.update({
    where: { id: loanId },
    data: { ...data, outstandingBalance: newOutstanding, status: newOutstanding <= 0 ? "COMPLETED" : loan.status },
  });

  await logAudit(ctx, {
    action: "LOAN_ADMIN_ADJUSTED",
    entityType: "Loan",
    entityId: loanId,
    before: {
      loanAmount: loan.loanAmount,
      interestRate: loan.interestRate,
      durationMonths: loan.durationMonths,
      outstandingBalance: loan.outstandingBalance,
    },
    after: {
      loanAmount: updated.loanAmount,
      interestRate: updated.interestRate,
      durationMonths: updated.durationMonths,
      outstandingBalance: updated.outstandingBalance,
    },
  });
  return updated;
}

/**
 * Recomputes what's actually owed today for a loan being part-paid or fully liquidated before
 * its term ends: full remaining principal, plus interest only for periods that have actually
 * elapsed — any interest that would have accrued on periods still in the future is rebated. Pure
 * recompute; it only adjusts outstandingBalance, it doesn't collect a payment — follow up with
 * recordManualLoanRepayment for the actual collection against the corrected figure.
 */
export async function recomputeEarlyPayoff(ctx: Ctx, loanId: string, asOfDate?: string) {
  requirePerm(ctx, "loan.manage");
  const loan = await db.loan.findUniqueOrThrow({ where: { id: loanId } });
  if (loan.status !== "ACTIVE") throw new Error("Only active loans can be recomputed for early payoff.");

  const asOf = asOfDate ? new Date(asOfDate) : new Date();
  const elapsedMonths = Math.min(
    Math.max(monthsBetween(loan.startMonth, asOf) + 1, 0),
    loan.durationMonths,
  );

  const calc = calcLoan(num(loan.loanAmount), num(loan.interestRate), loan.durationMonths, loan.repaymentType as RepaymentType);
  const totalPrincipal = round2(calc.schedule.reduce((a, r) => a + r.principal, 0));
  const interestAccrued = round2(calc.schedule.slice(0, elapsedMonths).reduce((a, r) => a + r.interest, 0));
  const fairObligation = round2(totalPrincipal + interestAccrued);

  const paidAgg = await db.loanRepayment.aggregate({ where: { loanId }, _sum: { amount: true } });
  const totalPaid = num(paidAgg._sum.amount ?? 0);
  const newOutstanding = Math.max(round2(fairObligation - totalPaid), 0);

  if (newOutstanding >= num(loan.outstandingBalance)) {
    throw new Error("No early-payoff rebate applies — the loan's current balance already reflects interest accrued to date.");
  }

  const updated = await db.loan.update({ where: { id: loanId }, data: { outstandingBalance: newOutstanding } });
  await logAudit(ctx, {
    action: "LOAN_EARLY_PAYOFF_RECOMPUTED",
    entityType: "Loan",
    entityId: loanId,
    before: { outstandingBalance: loan.outstandingBalance },
    after: { outstandingBalance: newOutstanding, elapsedMonths, interestAccrued, totalPrincipal },
  });
  return updated;
}

export type LoanAgeBucket = "CURRENT" | "DAYS_1_30" | "DAYS_31_60" | "DAYS_61_90" | "DAYS_90_PLUS";

export interface LoanAgeRow {
  loanId: string;
  memberId: string;
  memberName: string;
  outstandingBalance: number;
  daysOverdue: number;
  bucket: LoanAgeBucket;
}

export interface LoanAgeAnalysis {
  rows: LoanAgeRow[];
  totals: Record<LoanAgeBucket, number>;
  counts: Record<LoanAgeBucket, number>;
}

function bucketForDays(days: number): LoanAgeBucket {
  if (days <= 0) return "CURRENT";
  if (days <= 30) return "DAYS_1_30";
  if (days <= 60) return "DAYS_31_60";
  if (days <= 90) return "DAYS_61_90";
  return "DAYS_90_PLUS";
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Ages every active loan by how overdue it is — days since the due date of the oldest
 * installment that hasn't been collected yet, based on installments actually posted so far
 * (same "deferred, not forgiven" model the schedule itself uses). A loan currently within its
 * suspension window is deliberately deferred, not delinquent, so it's always CURRENT regardless
 * of how much calendar time has passed.
 */
export async function getLoanAgeAnalysis(ctx: Ctx): Promise<LoanAgeAnalysis> {
  requirePerm(ctx, "loan.view");
  const today = new Date();
  const loans = await db.loan.findMany({
    where: { status: "ACTIVE" },
    include: { _count: { select: { repayments: true } }, member: { select: { id: true, fullName: true } } },
  });

  const rows: LoanAgeRow[] = loans.map((loan) => {
    const suspended = !!loan.suspendedFrom && !!loan.suspendedUntil && loan.suspendedFrom <= today && today < loan.suspendedUntil;
    const nextDueDate = addMonths(loan.startMonth, loan._count.repayments);
    const daysOverdue = suspended || nextDueDate > today ? 0 : Math.floor((today.getTime() - nextDueDate.getTime()) / MS_PER_DAY);
    return {
      loanId: loan.id,
      memberId: loan.member.id,
      memberName: loan.member.fullName,
      outstandingBalance: num(loan.outstandingBalance),
      daysOverdue,
      bucket: bucketForDays(daysOverdue),
    };
  });

  const buckets: LoanAgeBucket[] = ["CURRENT", "DAYS_1_30", "DAYS_31_60", "DAYS_61_90", "DAYS_90_PLUS"];
  const totals = Object.fromEntries(buckets.map((b) => [b, 0])) as Record<LoanAgeBucket, number>;
  const counts = Object.fromEntries(buckets.map((b) => [b, 0])) as Record<LoanAgeBucket, number>;
  for (const row of rows) {
    totals[row.bucket] = round2(totals[row.bucket] + row.outstandingBalance);
    counts[row.bucket] += 1;
  }

  return { rows, totals, counts };
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
 *
 * Like sales' direct payments, this has no fixed per-installment schedule to allocate against
 * (it's any amount, any time), so the interest portion is allocated proportionally to the loan's
 * overall interest-to-total ratio, capped at whatever interest hasn't been recognized yet — this
 * is what feeds the loan interest income reports instead of understating them as 0.
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

  const priorInterestAgg = await db.loanRepayment.aggregate({ where: { loanId }, _sum: { interest: true } });
  const priorInterest = num(priorInterestAgg._sum.interest ?? 0);
  const remainingInterest = Math.max(round2(num(loan.totalInterest) - priorInterest), 0);
  const proportionalInterest = round2(applied * (num(loan.totalInterest) / num(loan.totalRepayment)));
  const interestPortion = Math.min(proportionalInterest, remainingInterest, applied);
  const principalPortion = round2(applied - interestPortion);

  const [repayment] = await db.$transaction([
    db.loanRepayment.create({
      data: {
        loanId,
        month,
        amount: applied,
        principal: principalPortion,
        interest: interestPortion,
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
