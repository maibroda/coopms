import { NextRequest, NextResponse } from "next/server";
import { requireAction } from "@/lib/auth/session";
import { previewSchedule } from "@/lib/services/schedule";
import { fromMonthInput, periodName } from "@/lib/dates";
import { num } from "@/lib/money";

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const ctx = await requireAction("schedule.view");
  const monthInput = req.nextUrl.searchParams.get("month");
  if (!monthInput) return NextResponse.json({ error: "month is required" }, { status: 400 });
  const month = fromMonthInput(monthInput);
  const preview = await previewSchedule(ctx, month);

  const header = ["Membership Number", "Member", "Department", "Savings", "Loan Repayment — Principal", "Loan Repayment — Interest", "Total Deduction"];
  const lines = [header.map(csvCell).join(",")];
  for (const r of preview.rows) {
    lines.push(
      [
        r.membershipNumber,
        r.fullName,
        r.department ?? "",
        num(r.savings).toFixed(2),
        num(r.loanPrincipal).toFixed(2),
        num(r.loanInterest).toFixed(2),
        num(r.total).toFixed(2),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  lines.push(
    ["", "", "Total", preview.totals.savings.toFixed(2), preview.totals.loanPrincipal.toFixed(2), preview.totals.loanInterest.toFixed(2), preview.totals.total.toFixed(2)]
      .map(csvCell)
      .join(","),
  );

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="deduction-schedule-${periodName(month).replace(" ", "-")}.csv"`,
    },
  });
}
