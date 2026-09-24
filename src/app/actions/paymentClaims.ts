"use server";
import { act } from "./_run";
import * as svc from "@/lib/services/paymentClaims";

type V = Record<string, unknown>;

export async function submitPaymentClaimAction(v: V) {
  return act(
    "self.request",
    async (ctx) => {
      await svc.submitPaymentClaim(ctx, {
        target: (v.target as "LOAN" | "SAVINGS") ?? "SAVINGS",
        loanId: v.loanId ? String(v.loanId) : null,
        amount: Number(v.amount),
        paidOn: String(v.paidOn),
        reference: String(v.reference ?? ""),
        note: v.note ? String(v.note) : null,
      });
      return { message: "Payment reported — the Treasurer will verify it against the bank statement and confirm it." };
    },
    ["/me", "/payments"],
  );
}

export async function confirmPaymentClaimAction(claimId: string) {
  return act(
    "payments.manage",
    async (ctx) => {
      await svc.confirmPaymentClaim(ctx, claimId);
      return { message: "Payment confirmed and applied." };
    },
    ["/payments", "/loans", "/members"],
  );
}

export async function rejectPaymentClaimAction(claimId: string, reason: string) {
  return act(
    "payments.manage",
    async (ctx) => {
      await svc.rejectPaymentClaim(ctx, claimId, reason);
      return { message: "Payment claim rejected." };
    },
    ["/payments"],
  );
}
