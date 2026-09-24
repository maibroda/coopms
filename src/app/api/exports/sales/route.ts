import { NextResponse } from "next/server";
import { requireAction } from "@/lib/auth/session";
import { exportSalesXlsx } from "@/lib/services/exports";

export async function GET() {
  const ctx = await requireAction("sale.view");
  const buffer = await exportSalesXlsx(ctx);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="product-sales.xlsx"`,
    },
  });
}
