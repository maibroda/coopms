"use server";
import { act } from "./_run";
import * as svc from "@/lib/services/settings";

type V = Record<string, unknown>;

export async function updateSettingsAction(v: V) {
  return act(
    "settings.manage",
    async (ctx) => {
      await svc.updateSettings(ctx, {
        orgName: String(v.orgName ?? ""),
        logoUrl: v.logoUrl ? String(v.logoUrl) : null,
        currencySymbol: String(v.currencySymbol ?? "₦"),
        loanEligibilityMultiplier: Number(v.loanEligibilityMultiplier ?? 1.5),
      });
      return { message: "Settings updated." };
    },
    ["/settings/organization", "/", "/dashboard", "/me"],
  );
}

export async function createLoanProductAction(v: V) {
  return act(
    "settings.manage",
    async (ctx) => {
      await svc.createLoanProduct(ctx, {
        name: String(v.name ?? ""),
        interestRate: Number(v.interestRate),
        durationMonths: Number(v.durationMonths),
        repaymentType: (v.repaymentType as "FLAT" | "REDUCING") ?? "FLAT",
      });
      return { message: "Loan product added." };
    },
    ["/settings/organization"],
  );
}

export async function setLoanProductActiveAction(id: string, isActive: boolean) {
  return act(
    "settings.manage",
    async (ctx) => {
      await svc.setLoanProductActive(ctx, id, isActive);
      return { message: isActive ? "Loan product activated." : "Loan product deactivated." };
    },
    ["/settings/organization"],
  );
}
