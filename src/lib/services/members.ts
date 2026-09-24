import { db } from "@/lib/db";
import { num, round2, sum } from "@/lib/money";
import { logAudit } from "./auditLog";
import { paginate, type Paginated } from "@/lib/pagination";
import type { Ctx } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { ForbiddenError } from "@/lib/auth/permissions";

export interface MemberInput {
  membershipNumber?: string | null; // blank => auto-generate
  fullName: string;
  department?: string | null;
  employeeNumber?: string | null;
  dateJoined: string; // ISO date
  monthlyContribution: number;
  phone?: string | null;
  email?: string | null;
  openingSavingsBalance?: number;
  openingLoanBalance?: number;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
}

async function nextMembershipNumber(): Promise<string> {
  const last = await db.member.findFirst({
    where: { membershipNumber: { startsWith: "MEM-" } },
    orderBy: { membershipNumber: "desc" },
    select: { membershipNumber: true },
  });
  const lastN = last ? Number(last.membershipNumber.replace("MEM-", "")) : 0;
  const next = Number.isFinite(lastN) ? lastN + 1 : 1;
  return `MEM-${String(next).padStart(6, "0")}`;
}

function requirePerm(ctx: Ctx, perm: "member.view" | "member.manage") {
  if (!can(ctx.role, perm)) throw new ForbiddenError(perm);
}

export async function createMember(ctx: Ctx, input: MemberInput) {
  requirePerm(ctx, "member.manage");
  const membershipNumber = input.membershipNumber?.trim() || (await nextMembershipNumber());
  const existing = await db.member.findUnique({ where: { membershipNumber } });
  if (existing) throw new Error(`Membership number ${membershipNumber} is already in use.`);

  return db.member.create({
    data: {
      membershipNumber,
      fullName: input.fullName,
      department: input.department || null,
      employeeNumber: input.employeeNumber || null,
      dateJoined: new Date(input.dateJoined),
      monthlyContribution: input.monthlyContribution,
      phone: input.phone || null,
      email: input.email || null,
      openingSavingsBalance: input.openingSavingsBalance ?? 0,
      openingLoanBalance: input.openingLoanBalance ?? 0,
      bankName: input.bankName || null,
      bankAccountNumber: input.bankAccountNumber || null,
      bankAccountName: input.bankAccountName || null,
    },
  });
}

export async function updateMember(ctx: Ctx, id: string, input: MemberInput) {
  requirePerm(ctx, "member.manage");
  const before = await db.member.findUniqueOrThrow({ where: { id } });

  const newSavings = input.openingSavingsBalance ?? 0;
  const newLoan = input.openingLoanBalance ?? 0;
  if (num(before.openingSavingsBalance) !== newSavings || num(before.openingLoanBalance) !== newLoan) {
    await logAudit(ctx, {
      action: "MEMBER_OPENING_BALANCE_CHANGED",
      entityType: "Member",
      entityId: id,
      before: { openingSavingsBalance: num(before.openingSavingsBalance), openingLoanBalance: num(before.openingLoanBalance) },
      after: { openingSavingsBalance: newSavings, openingLoanBalance: newLoan },
    });
  }

  return db.member.update({
    where: { id },
    data: {
      fullName: input.fullName,
      department: input.department || null,
      employeeNumber: input.employeeNumber || null,
      dateJoined: new Date(input.dateJoined),
      monthlyContribution: input.monthlyContribution,
      phone: input.phone || null,
      email: input.email || null,
      openingSavingsBalance: newSavings,
      openingLoanBalance: newLoan,
      bankName: input.bankName || null,
      bankAccountNumber: input.bankAccountNumber || null,
      bankAccountName: input.bankAccountName || null,
    },
  });
}

export interface ExitImpact {
  savings: number;
  outstandingLoans: number;
  outstandingPurchases: number;
  netPayout: number;
  activeLoanCount: number;
  activeSaleCount: number;
}

/**
 * What deactivating this member would mean right now: their savings/loan/purchase position and
 * the net amount owed to (or by) them if they left today. Also the basis for the confirmation
 * step in setMemberStatus — a member with money still moving through the cooperative shouldn't
 * be deactivated by accident, since that silently drops them off every future payroll schedule.
 */
export async function checkExitImpact(memberId: string): Promise<ExitImpact> {
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });
  const [contributions, loans, sales] = await Promise.all([
    db.contribution.findMany({ where: { memberId }, select: { amount: true } }),
    db.loan.findMany({ where: { memberId, status: "ACTIVE" }, select: { outstandingBalance: true } }),
    db.productSale.findMany({ where: { memberId, status: "ACTIVE" }, select: { outstandingBalance: true } }),
  ]);
  const savings = sum([num(member.openingSavingsBalance), ...contributions.map((c) => num(c.amount))]);
  const outstandingLoans = sum([num(member.openingLoanBalance), ...loans.map((l) => num(l.outstandingBalance))]);
  const outstandingPurchases = sum(sales.map((s) => num(s.outstandingBalance)));
  return {
    savings,
    outstandingLoans,
    outstandingPurchases,
    netPayout: round2(savings - outstandingLoans - outstandingPurchases),
    activeLoanCount: loans.length,
    activeSaleCount: sales.length,
  };
}

export async function setMemberStatus(ctx: Ctx, id: string, status: "ACTIVE" | "INACTIVE", confirmed = false) {
  requirePerm(ctx, "member.manage");
  if (status === "INACTIVE") {
    const impact = await checkExitImpact(id);
    if ((impact.activeLoanCount > 0 || impact.activeSaleCount > 0) && !confirmed) {
      throw new Error(
        `This member has ${impact.activeLoanCount} active loan(s) and ${impact.activeSaleCount} active purchase(s) totalling ` +
          `₦${(impact.outstandingLoans + impact.outstandingPurchases).toLocaleString()} outstanding. Deactivating stops them being ` +
          `collected on any future payroll run — confirm you want to proceed anyway.`,
      );
    }
    await logAudit(ctx, { action: "MEMBER_DEACTIVATED", entityType: "Member", entityId: id, after: impact });
  }
  return db.member.update({ where: { id }, data: { status } });
}

function membersWhere(opts: { q?: string; status?: "ACTIVE" | "INACTIVE" }) {
  return {
    status: opts.status,
    ...(opts.q
      ? {
          OR: [
            { fullName: { contains: opts.q, mode: "insensitive" as const } },
            { membershipNumber: { contains: opts.q, mode: "insensitive" as const } },
            { department: { contains: opts.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

export async function listMembers(ctx: Ctx, opts: { q?: string; status?: "ACTIVE" | "INACTIVE" } = {}) {
  requirePerm(ctx, "member.view");
  return db.member.findMany({ where: membersWhere(opts), orderBy: { fullName: "asc" } });
}

export async function listMembersPaginated(
  ctx: Ctx,
  opts: { q?: string; status?: "ACTIVE" | "INACTIVE"; page: number; pageSize: number },
): Promise<Paginated<Awaited<ReturnType<typeof listMembers>>[number]>> {
  requirePerm(ctx, "member.view");
  const where = membersWhere(opts);
  const [items, total] = await Promise.all([
    db.member.findMany({ where, orderBy: { fullName: "asc" }, skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize }),
    db.member.count({ where }),
  ]);
  return paginate(items, total, opts.page, opts.pageSize);
}

/** Total savings = opening balance carried forward + every posted contribution. */
export async function totalSavings(memberId: string): Promise<number> {
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });
  const contributions = await db.contribution.findMany({ where: { memberId }, select: { amount: true } });
  return sum([num(member.openingSavingsBalance), ...contributions.map((c) => num(c.amount))]);
}

export async function memberSummary(ctx: Ctx, memberId: string) {
  requirePerm(ctx, "member.view");
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });
  const [contributions, loans, sales] = await Promise.all([
    db.contribution.findMany({ where: { memberId }, orderBy: { month: "asc" } }),
    db.loan.findMany({ where: { memberId }, orderBy: { createdAt: "desc" }, include: { repayments: { orderBy: { month: "asc" } } } }),
    db.productSale.findMany({ where: { memberId }, orderBy: { createdAt: "desc" }, include: { repayments: { orderBy: { month: "asc" } } } }),
  ]);

  const savings = sum([num(member.openingSavingsBalance), ...contributions.map((c) => num(c.amount))]);
  const outstandingLoans = sum([
    num(member.openingLoanBalance),
    ...loans.filter((l) => l.status === "ACTIVE").map((l) => num(l.outstandingBalance)),
  ]);
  const outstandingPurchases = sum(sales.filter((s) => s.status === "ACTIVE").map((s) => num(s.outstandingBalance)));
  const totalLoansCollected = sum(loans.map((l) => num(l.loanAmount)));
  const purchasesMade = sum(sales.map((s) => num(s.cost)));

  return {
    member,
    contributions,
    loans,
    sales,
    totals: {
      totalContributions: savings,
      totalLoansCollected,
      outstandingLoans,
      purchasesMade,
      outstandingPurchases,
      netPosition: round2(savings - outstandingLoans - outstandingPurchases),
    },
  };
}

export interface LedgerRow {
  month: Date;
  savingsIn: number;
  loanDisbursed: number;
  loanRepayment: number;
  savingsBalance: number;
  loanBalance: number;
}

export interface MemberLedger {
  openingSavingsBalance: number;
  openingLoanBalance: number;
  rows: LedgerRow[];
  closingSavingsBalance: number;
  closingLoanBalance: number;
}

/**
 * Monthly activity statement: balance brought forward, then each month's savings, loan
 * disbursements and loan repayments, with running savings/loan balances. This is what member
 * statements show instead of three disconnected tables.
 */
export async function memberLedger(memberId: string): Promise<MemberLedger> {
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });
  const [contributions, loans, repayments] = await Promise.all([
    db.contribution.findMany({ where: { memberId }, select: { month: true, amount: true } }),
    // PENDING/REJECTED loans were never actually disbursed, so they don't belong in the ledger.
    db.loan.findMany({
      where: { memberId, status: { notIn: ["PENDING", "REJECTED"] } },
      select: { startMonth: true, totalRepayment: true },
    }),
    db.loanRepayment.findMany({ where: { loan: { memberId } }, select: { month: true, amount: true } }),
  ]);

  const byMonth = new Map<number, { month: Date; savingsIn: number; loanDisbursed: number; loanRepayment: number }>();
  function bucket(month: Date) {
    const key = month.getTime();
    let b = byMonth.get(key);
    if (!b) {
      b = { month, savingsIn: 0, loanDisbursed: 0, loanRepayment: 0 };
      byMonth.set(key, b);
    }
    return b;
  }
  for (const c of contributions) {
    const b = bucket(c.month);
    b.savingsIn = round2(b.savingsIn + num(c.amount));
  }
  for (const l of loans) {
    const b = bucket(l.startMonth);
    // Recorded at the full repayable amount (principal + interest) so the running loan balance
    // reconciles exactly with Loan.outstandingBalance once repayments (also principal + interest) are subtracted.
    b.loanDisbursed = round2(b.loanDisbursed + num(l.totalRepayment));
  }
  for (const r of repayments) {
    const b = bucket(r.month);
    b.loanRepayment = round2(b.loanRepayment + num(r.amount));
  }

  const months = [...byMonth.values()].sort((a, b) => a.month.getTime() - b.month.getTime());

  let savingsBalance = num(member.openingSavingsBalance);
  let loanBalance = num(member.openingLoanBalance);
  const rows: LedgerRow[] = months.map((m) => {
    savingsBalance = round2(savingsBalance + m.savingsIn);
    loanBalance = round2(loanBalance + m.loanDisbursed - m.loanRepayment);
    return {
      month: m.month,
      savingsIn: m.savingsIn,
      loanDisbursed: m.loanDisbursed,
      loanRepayment: m.loanRepayment,
      savingsBalance,
      loanBalance,
    };
  });

  return {
    openingSavingsBalance: num(member.openingSavingsBalance),
    openingLoanBalance: num(member.openingLoanBalance),
    rows,
    closingSavingsBalance: savingsBalance,
    closingLoanBalance: loanBalance,
  };
}
