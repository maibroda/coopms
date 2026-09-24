import { NextResponse } from "next/server";
import { requireAction } from "@/lib/auth/session";
import { exportReportsXlsx } from "@/lib/services/exports";

export async function GET() {
  const ctx = await requireAction("reports.view");
  const buffer = await exportReportsXlsx(ctx);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="financial-reports.xlsx"`,
    },
  });
}
