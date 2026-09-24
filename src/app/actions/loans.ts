"use server";
import { act } from "./_run";
import * as svc from "@/lib/services/loans";

type V = Record<string, unknown>;

function loanFields(v: V) {
  return {
    loanAmount: Number(v.loanAmount),
    interestRate: Number(v.interestRate),
    durationMonths: Number(v.durationMonths),
    repaymentType: (v.repaymentType as "FLAT" | "REDUCING") ?? "FLAT",
    startMonth: String(v.startMonth),
    exceptionReason: v.exceptionReason ? String(v.exceptionReason) : null,
  };
}

export async function createLoanAction(v: V) {
  return act(
    "loan.manage",
    async (ctx) => {
      const loan = await svc.createLoan(ctx, { ...loanFields(v), memberId: String(v.memberId), note: v.note ? String(v.note) : null });
      const amount = `₦${Number(v.loanAmount).toLocaleString()}`;
      const message = loan.isExceptionRequest
        ? `Loan of ${amount} submitted as an eligibility exception — needs Admin approval.`
        : loan.status === "ACTIVE"
          ? `Loan of ${amount} created and active.`
          : `Loan of ${amount} submitted for approval.`;
      return { message, data: loan };
    },
    ["/loans", `/members/${v.memberId}`, "/approvals"],
  );
}

export async function requestLoanAction(v: V) {
  return act(
    "self.request",
    async (ctx) => {
      await svc.requestLoan(ctx, loanFields(v));
      return { message: "Loan request submitted — you'll be notified once it's reviewed." };
    },
    ["/me", "/approvals"],
  );
}

export async function approveLoanAction(loanId: string) {
  return act(
    "approvals.manage",
    async (ctx) => {
      await svc.approveLoan(ctx, loanId);
      return { message: "Loan approved and now active." };
    },
    ["/approvals", "/loans", "/members"],
  );
}

export async function rejectLoanAction(loanId: string, reason: string) {
  return act(
    "approvals.manage",
    async (ctx) => {
      await svc.rejectLoan(ctx, loanId, reason);
      return { message: "Loan request rejected." };
    },
    ["/approvals", "/loans", "/members"],
  );
}

export async function suspendLoanAction(loanId: string, memberId: string, from: string, until: string) {
  return act(
    "loan.manage",
    async (ctx) => {
      await svc.suspendLoan(ctx, loanId, from, until);
      return { message: "Loan deduction suspended for the selected period." };
    },
    ["/loans", `/members/${memberId}`],
  );
}

export async function resumeLoanAction(loanId: string, memberId: string) {
  return act(
    "loan.manage",
    async (ctx) => {
      await svc.resumeLoan(ctx, loanId);
      return { message: "Loan deduction resumed." };
    },
    ["/loans", `/members/${memberId}`],
  );
}

export async function markLoanStatusAction(loanId: string, memberId: string, status: "DEFAULTED" | "ACTIVE") {
  return act(
    "loan.manage",
    async (ctx) => {
      await svc.markLoanStatus(ctx, loanId, status);
      return { message: `Loan marked ${status.toLowerCase()}.` };
    },
    ["/loans", `/members/${memberId}`],
  );
}

export async function restructureLoanAction(loanId: string, memberId: string, v: V) {
  return act(
    "loan.manage",
    async (ctx) => {
      const newLoan = await svc.restructureLoan(ctx, loanId, {
        interestRate: Number(v.interestRate),
        durationMonths: Number(v.durationMonths),
        repaymentType: (v.repaymentType as "FLAT" | "REDUCING") ?? "FLAT",
        startMonth: String(v.startMonth),
      });
      return { message: `Loan restructured into a new ${newLoan.repaymentType.toLowerCase()} loan.` };
    },
    ["/loans", `/members/${memberId}`],
  );
}

export async function recordManualLoanRepaymentAction(loanId: string, memberId: string, v: V) {
  return act(
    "loan.manage",
    async (ctx) => {
      await svc.recordManualLoanRepayment(ctx, loanId, {
        amount: Number(v.amount),
        paidOn: String(v.paidOn),
        reference: v.reference ? String(v.reference) : null,
      });
      return { message: "Repayment recorded." };
    },
    ["/loans", `/members/${memberId}`],
  );
}
