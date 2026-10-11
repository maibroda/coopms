import { NextResponse } from "next/server";
import { requireAction } from "@/lib/auth/session";
import { exportDividendAllocationsXlsx } from "@/lib/services/exports";
import { getDeclaration } from "@/lib/services/dividends";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAction("dividend.view");
  const { id } = await params;
  const [declaration, buffer] = await Promise.all([getDeclaration(ctx, id), exportDividendAllocationsXlsx(ctx, id)]);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dividend-${declaration.year}.xlsx"`,
    },
  });
}
