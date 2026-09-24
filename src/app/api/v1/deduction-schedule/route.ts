import { NextRequest, NextResponse } from "next/server";
import { requireApiKey, API_CTX } from "@/lib/auth/apiContext";
import { previewSchedule } from "@/lib/services/schedule";
import { fromMonthInput } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const denied = await requireApiKey(req);
  if (denied) return denied;

  const monthInput = req.nextUrl.searchParams.get("month");
  if (!monthInput) return NextResponse.json({ error: "month query param (YYYY-MM) is required." }, { status: 400 });

  const preview = await previewSchedule(API_CTX, fromMonthInput(monthInput));
  return NextResponse.json({
    month: monthInput,
    alreadyPosted: preview.alreadyPosted,
    totals: preview.totals,
    members: preview.rows.map((r) => ({
      membershipNumber: r.membershipNumber,
      fullName: r.fullName,
      department: r.department,
      savings: r.savings,
      loanRepayment: r.loanRepayment,
      totalDeduction: r.total,
    })),
  });
}
