"use server";
import { act } from "./_run";
import * as svc from "@/lib/services/dividends";

export async function declareOrRecomputeDraftAction(year: number, declaredSurplus: number) {
  return act(
    "dividend.manage",
    async (ctx) => {
      const declaration = await svc.declareOrRecomputeDraft(ctx, { year, declaredSurplus });
      return { message: `${year} dividend declaration computed (draft).`, redirectTo: `/dividends/${declaration.id}` };
    },
    ["/dividends"],
  );
}

export async function approveDeclarationAction(id: string) {
  return act(
    "dividend.manage",
    async (ctx) => {
      await svc.approveDeclaration(ctx, id);
      return { message: "Declaration approved and locked." };
    },
    ["/dividends", `/dividends/${id}`, "/me"],
  );
}

export async function deleteDraftDeclarationAction(id: string) {
  return act(
    "dividend.manage",
    async (ctx) => {
      await svc.deleteDraftDeclaration(ctx, id);
      return { message: "Draft declaration deleted." };
    },
    ["/dividends"],
  );
}
