import { NextResponse } from "next/server";
import { requireAction } from "@/lib/auth/session";
import { generateBalanceTemplate } from "@/lib/services/balances";

export async function GET() {
  await requireAction("member.manage");
  const buffer = await generateBalanceTemplate();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="opening-balances-template.xlsx"`,
    },
  });
}
