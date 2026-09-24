"use server";
import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth/session";
import { importMembers, type MemberImportResult } from "@/lib/services/memberImport";

export async function importMembersAction(
  _prev: { error?: string; result?: MemberImportResult } | undefined,
  form: FormData,
): Promise<{ error?: string; result?: MemberImportResult }> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an .xlsx file to upload." };

  try {
    const ctx = await requireAction("member.manage");
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importMembers(ctx, file.name, buffer);
    revalidatePath("/members", "layout");
    return { result };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
