import { NextResponse } from "next/server";
import { requireAction } from "@/lib/auth/session";
import { generateMemberImportTemplate } from "@/lib/services/memberImport";

export async function GET() {
  await requireAction("member.manage");
  const buffer = await generateMemberImportTemplate();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="new-members-template.xlsx"`,
    },
  });
}
