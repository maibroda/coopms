"use server";
import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth/session";
import { importBalances, type BalanceImportResult } from "@/lib/services/balances";

export async function importBalancesAction(
  _prev: { error?: string; result?: BalanceImportResult } | undefined,
  form: FormData,
): Promise<{ error?: string; result?: BalanceImportResult }> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an .xlsx file to upload." };

  try {
    const ctx = await requireAction("member.manage");
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importBalances(ctx, file.name, buffer);
    revalidatePath("/members", "layout");
    return { result };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
