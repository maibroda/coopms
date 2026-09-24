import { NextRequest, NextResponse } from "next/server";
import { requireAction } from "@/lib/auth/session";
import { exportScheduleXlsx } from "@/lib/services/exports";
import { fromMonthInput, periodName } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const ctx = await requireAction("schedule.view");
  const monthInput = req.nextUrl.searchParams.get("month");
  if (!monthInput) return NextResponse.json({ error: "month is required" }, { status: 400 });
  const month = fromMonthInput(monthInput);
  const buffer = await exportScheduleXlsx(ctx, month);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="deduction-schedule-${periodName(month).replace(" ", "-")}.xlsx"`,
    },
  });
}
