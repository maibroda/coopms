import { NextResponse } from "next/server";
import { requireAction } from "@/lib/auth/session";
import { exportMembersXlsx } from "@/lib/services/exports";

export async function GET() {
  const ctx = await requireAction("member.view");
  const buffer = await exportMembersXlsx(ctx);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="members.xlsx"`,
    },
  });
}
