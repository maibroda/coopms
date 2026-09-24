import ExcelJS from "exceljs";
import { createMember } from "./members";
import { logAudit } from "./auditLog";
import type { Ctx } from "@/lib/auth/context";
import { can, ForbiddenError } from "@/lib/auth/permissions";

function requirePerm(ctx: Ctx) {
  if (!can(ctx.role, "member.manage")) throw new ForbiddenError("member.manage");
}

const COLUMNS = [
  { header: "ID No (blank = auto-generate)", key: "id" },
  { header: "Full Name", key: "name" },
  { header: "Department", key: "dept" },
  { header: "Employee Number", key: "emp" },
  { header: "Date Joined (YYYY-MM-DD)", key: "joined" },
  { header: "Monthly Contribution", key: "mc" },
  { header: "Phone", key: "phone" },
  { header: "Email", key: "email" },
  { header: "Opening Savings Balance", key: "savings" },
  { header: "Opening Loan Balance", key: "loan" },
  { header: "Bank Name", key: "bank" },
  { header: "Bank Account Number", key: "acct" },
  { header: "Bank Account Name", key: "acctName" },
];

export async function generateMemberImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("New Members");
  ws.columns = COLUMNS.map((c) => ({ ...c, width: 22 }));
  ws.getRow(1).font = { bold: true };
  ws.addRow({
    id: "",
    name: "Jane Example",
    dept: "Finance",
    emp: "EMP-9001",
    joined: "2026-01-01",
    mc: 10000,
    phone: "08030000000",
    email: "jane.example@coop.test",
    savings: 0,
    loan: 0,
    bank: "GTBank",
    acct: "0123456789",
    acctName: "JANE EXAMPLE",
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export interface MemberImportRowResult {
  rowNumber: number;
  membershipNumber: string;
  fullName: string;
  status: "APPLIED" | "FAILED";
  message: string | null;
}

export interface MemberImportResult {
  total: number;
  applied: number;
  failed: number;
  rows: MemberImportRowResult[];
}

function colIndex(headers: string[], match: string): number {
  return headers.findIndex((h) => h.includes(match));
}

/** Creates new members from a spreadsheet — a bulk version of the "Add member" form. */
export async function importMembers(ctx: Ctx, fileName: string, buffer: Buffer): Promise<MemberImportResult> {
  requirePerm(ctx);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("The uploaded file has no worksheet.");

  const headers = Array.from(ws.getRow(1).values as unknown[], (h) => String(h ?? "").trim().toLowerCase());
  const idCol = colIndex(headers, "id no");
  const nameCol = colIndex(headers, "full name");
  const deptCol = colIndex(headers, "department");
  const empCol = colIndex(headers, "employee");
  const joinedCol = colIndex(headers, "date joined");
  const mcCol = colIndex(headers, "monthly contribution");
  const phoneCol = colIndex(headers, "phone");
  const emailCol = colIndex(headers, "email");
  const savingsCol = colIndex(headers, "opening savings");
  const loanCol = colIndex(headers, "opening loan");
  const bankCol = colIndex(headers, "bank name");
  const acctCol = colIndex(headers, "bank account number");
  const acctNameCol = colIndex(headers, "bank account name");

  if (nameCol < 0 || joinedCol < 0 || mcCol < 0) {
    throw new Error("Could not find the Full Name, Date Joined and Monthly Contribution columns. Use the provided template.");
  }

  const cell = (row: ExcelJS.Row, col: number) => (col >= 0 ? String(row.getCell(col).value ?? "").trim() : "");
  const numCell = (row: ExcelJS.Row, col: number) => {
    if (col < 0) return 0;
    const v = row.getCell(col).value;
    return typeof v === "number" ? v : Number(v) || 0;
  };

  const results: MemberImportRowResult[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const fullName = cell(row, nameCol);
    if (!fullName) continue;

    const membershipNumber = idCol >= 0 ? cell(row, idCol) : "";
    const dateJoined = cell(row, joinedCol);
    let status: "APPLIED" | "FAILED" = "APPLIED";
    let message: string | null = null;

    if (!dateJoined || Number.isNaN(new Date(dateJoined).getTime())) {
      status = "FAILED";
      message = "Date Joined is missing or not a valid date.";
    } else {
      try {
        const member = await createMember(ctx, {
          membershipNumber: membershipNumber || null,
          fullName,
          department: cell(row, deptCol) || null,
          employeeNumber: cell(row, empCol) || null,
          dateJoined,
          monthlyContribution: numCell(row, mcCol),
          phone: cell(row, phoneCol) || null,
          email: cell(row, emailCol) || null,
          openingSavingsBalance: numCell(row, savingsCol),
          openingLoanBalance: numCell(row, loanCol),
          bankName: cell(row, bankCol) || null,
          bankAccountNumber: cell(row, acctCol) || null,
          bankAccountName: cell(row, acctNameCol) || null,
        });
        results.push({ rowNumber: r, membershipNumber: member.membershipNumber, fullName, status: "APPLIED", message: null });
        continue;
      } catch (e) {
        status = "FAILED";
        message = (e as Error).message;
      }
    }

    results.push({ rowNumber: r, membershipNumber: membershipNumber || "—", fullName, status, message });
  }

  const applied = results.filter((r) => r.status === "APPLIED").length;
  const failed = results.length - applied;

  await logAudit(ctx, {
    action: "MEMBER_IMPORT",
    entityType: "Member",
    entityId: "bulk-import",
    after: { fileName, total: results.length, applied, failed },
  });

  return { total: results.length, applied, failed, rows: results };
}
