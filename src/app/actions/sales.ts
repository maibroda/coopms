"use server";
import { act } from "./_run";
import * as svc from "@/lib/services/sales";

type V = Record<string, unknown>;

function saleFields(v: V) {
  return {
    itemName: String(v.itemName),
    category: (v.category as "PHONE" | "LAPTOP" | "FOOD" | "APPLIANCE" | "OTHER") ?? "OTHER",
    cost: Number(v.cost),
    interestRate: Number(v.interestRate),
    durationMonths: Number(v.durationMonths),
    startMonth: String(v.startMonth),
    exceptionReason: v.exceptionReason ? String(v.exceptionReason) : null,
  };
}

export async function createSaleAction(v: V) {
  return act(
    "sale.manage",
    async (ctx) => {
      const sale = await svc.createSale(ctx, { ...saleFields(v), memberId: String(v.memberId) });
      const message = sale.isExceptionRequest
        ? `${sale.itemName} submitted as an eligibility exception — needs Admin approval.`
        : sale.status === "ACTIVE"
          ? `${sale.itemName} recorded and active.`
          : `${sale.itemName} submitted for approval.`;
      return { message };
    },
    ["/sales", `/members/${v.memberId}`, "/approvals"],
  );
}

export async function requestSaleAction(v: V) {
  return act(
    "self.request",
    async (ctx) => {
      await svc.requestSale(ctx, saleFields(v));
      return { message: "Purchase request submitted — you'll be notified once it's reviewed." };
    },
    ["/me", "/approvals"],
  );
}

export async function approveSaleAction(saleId: string) {
  return act(
    "approvals.manage",
    async (ctx) => {
      await svc.approveSale(ctx, saleId);
      return { message: "Purchase approved and now active." };
    },
    ["/approvals", "/sales", "/members"],
  );
}

export async function rejectSaleAction(saleId: string, reason: string) {
  return act(
    "approvals.manage",
    async (ctx) => {
      await svc.rejectSale(ctx, saleId, reason);
      return { message: "Purchase request rejected." };
    },
    ["/approvals", "/sales", "/members"],
  );
}

export async function recordSaleRepaymentAction(saleId: string, memberId: string, v: V) {
  return act(
    "sale.manage",
    async (ctx) => {
      await svc.recordSaleRepayment(ctx, saleId, {
        amount: Number(v.amount),
        paidOn: String(v.paidOn),
        reference: v.reference ? String(v.reference) : null,
      });
      return { message: "Repayment recorded." };
    },
    ["/sales", `/members/${memberId}`],
  );
}
