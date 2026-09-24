import { db } from "@/lib/db";
import { num, round2 } from "@/lib/money";
import { monthStart } from "@/lib/dates";
import { recordManualLoanRepayment } from "./loans";
import { logAudit } from "./auditLog";
import type { Ctx } from "@/lib/auth/context";
import { can, ForbiddenError } from "@/lib/auth/permissions";

function requirePerm(ctx: Ctx, perm: "self.request" | "payments.manage") {
  if (!can(ctx.role, perm)) throw new ForbiddenError(perm);
}

export interface PaymentClaimInput {
  target: "LOAN" | "SAVINGS";
  loanId?: string | null;
  amount: number;
  paidOn: string;
  reference: string;
  note?: string | null;
}

/**
 * A member reports a direct payment they made into the cooperative's bank account — to repay a
 * loan (including paying it off early) or to top up their savings outside the payroll deduction.
 * This never touches balances by itself: it's a claim, sitting PENDING until a Treasurer/Admin
 * checks it against the actual bank statement and confirms it. That verification step is the
 * whole point — crediting an unverified self-report would let a member claim a payment that
 * never happened.
 */
export async function submitPaymentClaim(ctx: Ctx, input: PaymentClaimInput) {
  requirePerm(ctx, "self.request");
  if (!ctx.memberId) throw new Error("Your account isn't linked to a membership record yet.");
  if (input.amount <= 0) throw new Error("Amount must be greater than zero.");
  if (!input.reference?.trim()) throw new Error("Enter the bank transfer/teller reference so the Treasurer can verify it.");
  if (input.target === "LOAN") {
    if (!input.loanId) throw new Error("Select which loan this payment is for.");
    const loan = await db.loan.findUniqueOrThrow({ where: { id: input.loanId } });
    if (loan.memberId !== ctx.memberId) throw new Error("That loan doesn't belong to your account.");
    if (loan.status !== "ACTIVE") throw new Error("That loan isn't active.");
  }

  const claim = await db.paymentClaim.create({
    data: {
      memberId: ctx.memberId,
      target: input.target,
      loanId: input.target === "LOAN" ? input.loanId : null,
      amount: round2(input.amount),
      paidOn: new Date(input.paidOn),
      reference: input.reference.trim(),
      note: input.note || null,
    },
  });
  await logAudit(ctx, { action: "PAYMENT_CLAIM_SUBMITTED", entityType: "PaymentClaim", entityId: claim.id, after: claim });
  return claim;
}

export async function listPendingPaymentClaims(ctx: Ctx) {
  requirePerm(ctx, "payments.manage");
  return db.paymentClaim.findMany({
    where: { status: "PENDING" },
    include: { member: true, loan: true },
    orderBy: { submittedAt: "asc" },
  });
}

export async function listMyPaymentClaims(ctx: Ctx) {
  requirePerm(ctx, "self.request");
  if (!ctx.memberId) return [];
  return db.paymentClaim.findMany({ where: { memberId: ctx.memberId }, include: { loan: true }, orderBy: { submittedAt: "desc" } });
}

/** Verifying and crediting a claim: LOAN applies it as a manual repayment; SAVINGS tops up that month's contribution. */
export async function confirmPaymentClaim(ctx: Ctx, claimId: string) {
  requirePerm(ctx, "payments.manage");
  const claim = await db.paymentClaim.findUniqueOrThrow({ where: { id: claimId } });
  if (claim.status !== "PENDING") throw new Error("This claim has already been reviewed.");

  if (claim.target === "LOAN") {
    if (!claim.loanId) throw new Error("Claim is missing its loan reference.");
    await recordManualLoanRepayment(ctx, claim.loanId, {
      amount: num(claim.amount),
      paidOn: claim.paidOn.toISOString(),
      reference: claim.reference,
    });
  } else {
    const month = monthStart(claim.paidOn.getUTCFullYear(), claim.paidOn.getUTCMonth() + 1);
    const existing = await db.contribution.findUnique({ where: { memberId_month: { memberId: claim.memberId, month } } });
    if (existing) {
      await db.contribution.update({ where: { id: existing.id }, data: { amount: round2(num(existing.amount) + num(claim.amount)) } });
    } else {
      await db.contribution.create({ data: { memberId: claim.memberId, month, amount: num(claim.amount) } });
    }
  }

  const updated = await db.paymentClaim.update({
    where: { id: claimId },
    data: { status: "CONFIRMED", reviewedById: ctx.userId, reviewedAt: new Date() },
  });
  await logAudit(ctx, { action: "PAYMENT_CLAIM_CONFIRMED", entityType: "PaymentClaim", entityId: claimId, before: claim, after: updated });
  return updated;
}

export async function rejectPaymentClaim(ctx: Ctx, claimId: string, reason: string) {
  requirePerm(ctx, "payments.manage");
  const claim = await db.paymentClaim.findUniqueOrThrow({ where: { id: claimId } });
  if (claim.status !== "PENDING") throw new Error("This claim has already been reviewed.");
  const updated = await db.paymentClaim.update({
    where: { id: claimId },
    data: { status: "REJECTED", reviewedById: ctx.userId, reviewedAt: new Date(), rejectionReason: reason },
  });
  await logAudit(ctx, { action: "PAYMENT_CLAIM_REJECTED", entityType: "PaymentClaim", entityId: claimId, before: claim, after: updated });
  return updated;
}
