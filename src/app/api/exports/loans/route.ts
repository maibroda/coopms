import { NextResponse } from "next/server";
import { requireAction } from "@/lib/auth/session";
import { exportLoansXlsx } from "@/lib/services/exports";

export async function GET() {
  const ctx = await requireAction("loan.view");
  const buffer = await exportLoansXlsx(ctx);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="loans.xlsx"`,
    },
  });
}
