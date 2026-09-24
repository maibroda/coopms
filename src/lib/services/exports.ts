import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { num, sum } from "@/lib/money";
import { periodName } from "@/lib/dates";
import { listMembers, totalSavings } from "./members";
import { listLoans } from "./loans";
import { listSales } from "./sales";
import { previewSchedule } from "./schedule";
import type { Ctx } from "@/lib/auth/context";
import { can, ForbiddenError } from "@/lib/auth/permissions";

function styleHeader(ws: ExcelJS.Worksheet) {
  ws.getRow(1).font = { bold: true };
}

async function toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function exportMembersXlsx(ctx: Ctx): Promise<Buffer> {
  const members = await listMembers(ctx);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Members");
  ws.columns = [
    { header: "Membership No", key: "no", width: 16 },
    { header: "Full Name", key: "name", width: 26 },
    { header: "Department", key: "dept", width: 20 },
    { header: "Date Joined", key: "joined", width: 14 },
    { header: "Monthly Contribution", key: "mc", width: 20 },
    { header: "Savings Balance", key: "savings", width: 18 },
    { header: "Status", key: "status", width: 12 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Email", key: "email", width: 26 },
    { header: "Bank", key: "bank", width: 16 },
    { header: "Account Number", key: "acct", width: 16 },
  ];
  for (const m of members) {
    ws.addRow({
      no: m.membershipNumber,
      name: m.fullName,
      dept: m.department ?? "",
      joined: m.dateJoined.toISOString().slice(0, 10),
      mc: num(m.monthlyContribution),
      savings: await totalSavings(m.id),
      status: m.status,
      phone: m.phone ?? "",
      email: m.email ?? "",
      bank: m.bankName ?? "",
      acct: m.bankAccountNumber ?? "",
    });
  }
  styleHeader(ws);
  return toBuffer(wb);
}

export async function exportLoansXlsx(ctx: Ctx): Promise<Buffer> {
  const loans = await listLoans(ctx);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Loans");
  ws.columns = [
    { header: "Membership No", key: "no", width: 16 },
    { header: "Member", key: "name", width: 26 },
    { header: "Loan Amount", key: "amount", width: 16 },
    { header: "Rate %", key: "rate", width: 10 },
    { header: "Type", key: "type", width: 12 },
    { header: "Duration (months)", key: "duration", width: 16 },
    { header: "Start Month", key: "start", width: 14 },
    { header: "Monthly Repayment", key: "monthly", width: 18 },
    { header: "Outstanding Balance", key: "outstanding", width: 18 },
    { header: "Status", key: "status", width: 14 },
  ];
  for (const l of loans) {
    ws.addRow({
      no: l.member.membershipNumber,
      name: l.member.fullName,
      amount: num(l.loanAmount),
      rate: num(l.interestRate),
      type: l.repaymentType,
      duration: l.durationMonths,
      start: l.startMonth.toISOString().slice(0, 10),
      monthly: num(l.monthlyRepayment),
      outstanding: num(l.outstandingBalance),
      status: l.suspendedUntil ? "SUSPENDED" : l.status,
    });
  }
  styleHeader(ws);
  return toBuffer(wb);
}

export async function exportSalesXlsx(ctx: Ctx): Promise<Buffer> {
  const sales = await listSales(ctx);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Product Sales");
  ws.columns = [
    { header: "Membership No", key: "no", width: 16 },
    { header: "Member", key: "name", width: 26 },
    { header: "Item", key: "item", width: 26 },
    { header: "Category", key: "category", width: 14 },
    { header: "Cost", key: "cost", width: 14 },
    { header: "Start Month", key: "start", width: 14 },
    { header: "Monthly Deduction", key: "monthly", width: 18 },
    { header: "Outstanding Balance", key: "outstanding", width: 18 },
    { header: "Status", key: "status", width: 14 },
  ];
  for (const s of sales) {
    ws.addRow({
      no: s.member.membershipNumber,
      name: s.member.fullName,
      item: s.itemName,
      category: s.category,
      cost: num(s.cost),
      start: s.startMonth.toISOString().slice(0, 10),
      monthly: num(s.monthlyDeduction),
      outstanding: num(s.outstandingBalance),
      status: s.status,
    });
  }
  styleHeader(ws);
  return toBuffer(wb);
}

export async function exportScheduleXlsx(ctx: Ctx, month: Date): Promise<Buffer> {
  const preview = await previewSchedule(ctx, month);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(periodName(month));
  ws.columns = [
    { header: "Membership No", key: "no", width: 16 },
    { header: "Member", key: "name", width: 26 },
    { header: "Department", key: "dept", width: 20 },
    { header: "Savings", key: "savings", width: 14 },
    { header: "Loan Repayment", key: "loan", width: 16 },
    { header: "Total Deduction", key: "total", width: 16 },
  ];
  for (const r of preview.rows) {
    ws.addRow({ no: r.membershipNumber, name: r.fullName, dept: r.department ?? "", savings: r.savings, loan: r.loanRepayment, total: r.total });
  }
  ws.addRow({});
  ws.addRow({ name: "Total", savings: preview.totals.savings, loan: preview.totals.loanRepayment, total: preview.totals.total });
  ws.getRow(ws.rowCount).font = { bold: true };
  styleHeader(ws);
  return toBuffer(wb);
}

/** A multi-sheet workbook mirroring the Reports page, for handing numbers to the board/auditors. */
export async function exportReportsXlsx(ctx: Ctx): Promise<Buffer> {
  if (!can(ctx.role, "reports.view")) throw new ForbiddenError("reports.view");
  const [contributions, loans, sales, loanRepayments] = await Promise.all([
    db.contribution.findMany({ include: { member: true } }),
    db.loan.findMany({ include: { member: true } }),
    db.productSale.findMany({ include: { member: true } }),
    db.loanRepayment.findMany(),
  ]);

  const disbursedLoans = loans.filter((l) => l.status !== "PENDING" && l.status !== "REJECTED");
  const disbursedSales = sales.filter((s) => s.status !== "PENDING" && s.status !== "REJECTED");
  const interestEarned = sum(loanRepayments.map((r) => num(r.interest)));

  const wb = new ExcelJS.Workbook();

  const loanSheet = wb.addWorksheet("Loan Report");
  loanSheet.columns = [
    { header: "Metric", key: "k", width: 30 },
    { header: "Value", key: "v", width: 20 },
  ];
  loanSheet.addRow({ k: "Loans granted", v: disbursedLoans.length });
  loanSheet.addRow({ k: "Total principal", v: sum(disbursedLoans.map((l) => num(l.loanAmount))) });
  loanSheet.addRow({ k: "Interest earned (posted)", v: interestEarned });
  loanSheet.addRow({ k: "Outstanding principal", v: sum(loans.filter((l) => l.status === "ACTIVE").map((l) => num(l.outstandingBalance))) });
  styleHeader(loanSheet);

  const byMember = new Map<string, { name: string; total: number }>();
  for (const c of contributions) {
    const cur = byMember.get(c.memberId) ?? { name: c.member.fullName, total: 0 };
    cur.total += num(c.amount);
    byMember.set(c.memberId, cur);
  }
  const contribSheet = wb.addWorksheet("Contributions by Member");
  contribSheet.columns = [
    { header: "Member", key: "name", width: 26 },
    { header: "Total Contributions", key: "total", width: 20 },
  ];
  for (const v of byMember.values()) contribSheet.addRow(v);
  styleHeader(contribSheet);

  const byCategory = new Map<string, { salesValue: number; interestEarned: number }>();
  for (const s of disbursedSales) {
    const cur = byCategory.get(s.category) ?? { salesValue: 0, interestEarned: 0 };
    cur.salesValue += num(s.cost);
    cur.interestEarned += num(s.totalInterest);
    byCategory.set(s.category, cur);
  }
  const salesSheet = wb.addWorksheet("Sales by Category");
  salesSheet.columns = [
    { header: "Category", key: "cat", width: 16 },
    { header: "Sales Value", key: "value", width: 18 },
    { header: "Interest Earned", key: "interest", width: 18 },
  ];
  for (const [cat, v] of byCategory) salesSheet.addRow({ cat, value: v.salesValue, interest: v.interestEarned });
  styleHeader(salesSheet);

  const incomeSheet = wb.addWorksheet("Income Report");
  incomeSheet.columns = [
    { header: "Source", key: "k", width: 26 },
    { header: "Amount", key: "v", width: 18 },
  ];
  const salesInterest = sum(disbursedSales.map((s) => num(s.totalInterest)));
  incomeSheet.addRow({ k: "Loan interest", v: interestEarned });
  incomeSheet.addRow({ k: "Sales interest (accrued)", v: salesInterest });
  incomeSheet.addRow({ k: "Total income", v: interestEarned + salesInterest });
  styleHeader(incomeSheet);

  return toBuffer(wb);
}
