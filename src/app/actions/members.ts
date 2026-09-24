"use server";
import { act } from "./_run";
import * as svc from "@/lib/services/members";

type V = Record<string, unknown>;

function toInput(v: V): svc.MemberInput {
  return {
    membershipNumber: v.membershipNumber ? String(v.membershipNumber) : null,
    fullName: String(v.fullName ?? ""),
    department: v.department ? String(v.department) : null,
    employeeNumber: v.employeeNumber ? String(v.employeeNumber) : null,
    dateJoined: String(v.dateJoined ?? ""),
    monthlyContribution: Number(v.monthlyContribution ?? 0),
    phone: v.phone ? String(v.phone) : null,
    email: v.email ? String(v.email) : null,
    openingSavingsBalance: v.openingSavingsBalance ? Number(v.openingSavingsBalance) : 0,
    openingLoanBalance: v.openingLoanBalance ? Number(v.openingLoanBalance) : 0,
    bankName: v.bankName ? String(v.bankName) : null,
    bankAccountNumber: v.bankAccountNumber ? String(v.bankAccountNumber) : null,
    bankAccountName: v.bankAccountName ? String(v.bankAccountName) : null,
  };
}

export async function createMemberAction(v: V) {
  return act(
    "member.manage",
    async (ctx) => {
      const m = await svc.createMember(ctx, toInput(v));
      return { message: `Member ${m.fullName} (${m.membershipNumber}) created.`, redirectTo: `/members/${m.id}` };
    },
    ["/members"],
  );
}

export async function updateMemberAction(id: string, v: V) {
  return act(
    "member.manage",
    async (ctx) => {
      await svc.updateMember(ctx, id, toInput(v));
      return { message: "Member updated.", redirectTo: `/members/${id}` };
    },
    ["/members", `/members/${id}`],
  );
}

export async function setMemberStatusAction(id: string, status: "ACTIVE" | "INACTIVE", confirmed = false) {
  return act(
    "member.manage",
    async (ctx) => {
      await svc.setMemberStatus(ctx, id, status, confirmed);
      return { message: `Member marked ${status.toLowerCase()}.` };
    },
    ["/members", `/members/${id}`],
  );
}
