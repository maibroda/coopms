import { requirePage } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { previewSchedule } from "@/lib/services/schedule";
import { naira } from "@/lib/money";
import { toMonthInput, fromMonthInput, periodName } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TFoot, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PostScheduleButton } from "@/components/forms/post-schedule-button";
import { MonthDropdown } from "@/components/month-dropdown";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const ctx = await requirePage("schedule.view");
  const { month: monthParam } = await searchParams;
  const monthInput = monthParam || toMonthInput(new Date());
  const month = fromMonthInput(monthInput);
  const preview = await previewSchedule(ctx, month);
  const canPost = can(ctx.role, "schedule.post");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Monthly Deduction Schedule</h1>
          <p className="text-sm text-muted-foreground">
            Total Deduction = Monthly Contribution (Savings) + active Loan Repayment(s). Product purchases are
            tracked separately and are not deducted through payroll.
          </p>
        </div>
        <form className="flex items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground/80">Month</label>
            <MonthDropdown name="month" defaultValue={monthInput} />
          </div>
          <Button variant="outline" type="submit">
            View
          </Button>
          <a href={`/api/schedule/export?month=${monthInput}`}>
            <Button variant="outline" type="button">
              Export CSV
            </Button>
          </a>
          <a href={`/api/schedule/export/xlsx?month=${monthInput}`}>
            <Button variant="outline" type="button">
              Export XLSX
            </Button>
          </a>
        </form>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{periodName(month)}</p>
        {preview.alreadyPosted ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
            Posted to payroll
          </span>
        ) : (
          canPost && <PostScheduleButton month={monthInput} />
        )}
      </div>

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Membership #</TH>
              <TH>Member</TH>
              <TH>Department</TH>
              <TH>Savings (₦)</TH>
              <TH>Loan Repayment — Principal (₦)</TH>
              <TH>Loan Repayment — Interest (₦)</TH>
              <TH>Of which deferment penalty (₦)</TH>
              <TH>Total Deduction (₦)</TH>
            </TR>
          </THead>
          <TBody>
            {preview.rows.map((r) => {
              const penalty = r.loanBreakdown.reduce((a, lb) => a + lb.penalty, 0);
              return (
                <TR key={r.memberId}>
                  <TD>{r.membershipNumber}</TD>
                  <TD>{r.fullName}</TD>
                  <TD>{r.department ?? "—"}</TD>
                  <TD>{naira(r.savings)}</TD>
                  <TD>{r.loanPrincipal ? naira(r.loanPrincipal) : "—"}</TD>
                  <TD>{r.loanInterest ? naira(r.loanInterest) : "—"}</TD>
                  <TD className={penalty > 0 ? "font-medium text-destructive" : "text-muted-foreground"}>
                    {penalty > 0 ? naira(penalty) : "—"}
                  </TD>
                  <TD className="font-medium">{naira(r.total)}</TD>
                </TR>
              );
            })}
            {preview.rows.length === 0 && (
              <TR>
                <TD colSpan={8} className="py-8 text-center text-muted-foreground">
                  No active members due for deduction this month.
                </TD>
              </TR>
            )}
          </TBody>
          <TFoot>
            <TR>
              <TD colSpan={3}>Total</TD>
              <TD>{naira(preview.totals.savings)}</TD>
              <TD>{naira(preview.totals.loanPrincipal)}</TD>
              <TD>{naira(preview.totals.loanInterest)}</TD>
              <TD>{naira(preview.rows.reduce((a, r) => a + r.loanBreakdown.reduce((b, lb) => b + lb.penalty, 0), 0))}</TD>
              <TD>{naira(preview.totals.total)}</TD>
            </TR>
          </TFoot>
        </Table>
      </Card>
    </div>
  );
}
