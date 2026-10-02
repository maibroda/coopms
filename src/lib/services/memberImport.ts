import ExcelJS from "exceljs";
import { createMember, composeFullName } from "./members";
import { logAudit } from "./auditLog";
import type { Ctx } from "@/lib/auth/context";
import { can, ForbiddenError } from "@/lib/auth/permissions";

function requirePerm(ctx: Ctx) {
  if (!can(ctx.role, "member.manage")) throw new ForbiddenError("member.manage");
}

const COLUMNS = [
  { header: "ID No (blank = auto-generate)", key: "id" },
  { header: "First Name", key: "first" },
  { header: "Middle Name", key: "middle" },
  { header: "Last Name", key: "last" },
  { header: "Gender (MALE/FEMALE/OTHER)", key: "gender" },
  { header: "Member Type (EMPLOYEE/EXTERNAL)", key: "memberType" },
  { header: "Region", key: "region" },
  { header: "House Address", key: "houseAddress" },
  { header: "Next of Kin Name", key: "nokName" },
  { header: "Next of Kin Address", key: "nokAddress" },
  { header: "Next of Kin Phone", key: "nokPhone" },
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

const REGION_VALUES = ["SOUTH_WEST", "LAGOS", "NORTH_CENTRAL", "NORTH_EAST", "SOUTH_SOUTH", "SOUTH_EAST"];
const GENDER_VALUES = ["MALE", "FEMALE", "OTHER"];
const MEMBER_TYPE_VALUES = ["EMPLOYEE", "EXTERNAL"];

export async function generateMemberImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("New Members");
  ws.columns = COLUMNS.map((c) => ({ ...c, width: 22 }));
  ws.getRow(1).font = { bold: true };
  ws.addRow({
    id: "",
    first: "Jane",
    middle: "",
    last: "Example",
    gender: "FEMALE",
    memberType: "EMPLOYEE",
    region: "LAGOS",
    houseAddress: "12 Example Street, Lagos",
    nokName: "John Example",
    nokAddress: "12 Example Street, Lagos",
    nokPhone: "08030000001",
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
  const firstCol = colIndex(headers, "first name");
  const middleCol = colIndex(headers, "middle name");
  const lastCol = colIndex(headers, "last name");
  const genderCol = colIndex(headers, "gender");
  const memberTypeCol = colIndex(headers, "member type");
  const regionCol = colIndex(headers, "region");
  const houseAddressCol = colIndex(headers, "house address");
  const nokNameCol = colIndex(headers, "next of kin name");
  const nokAddressCol = colIndex(headers, "next of kin address");
  const nokPhoneCol = colIndex(headers, "next of kin phone");
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

  if (firstCol < 0 || lastCol < 0 || joinedCol < 0 || mcCol < 0) {
    throw new Error(
      "Could not find the First Name, Last Name, Date Joined and Monthly Contribution columns. Use the provided template.",
    );
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
    const firstName = cell(row, firstCol);
    const lastName = cell(row, lastCol);
    if (!firstName && !lastName) continue;

    const membershipNumber = idCol >= 0 ? cell(row, idCol) : "";
    const dateJoined = cell(row, joinedCol);
    const fullName = composeFullName(firstName, cell(row, middleCol) || null, lastName);
    const gender = cell(row, genderCol).toUpperCase();
    const region = cell(row, regionCol).toUpperCase().replace(/\s+/g, "_");
    const memberType = (cell(row, memberTypeCol).toUpperCase() || "EMPLOYEE") as string;
    let status: "APPLIED" | "FAILED" = "APPLIED";
    let message: string | null = null;

    const missing: string[] = [];
    if (!firstName) missing.push("First Name");
    if (!lastName) missing.push("Last Name");
    if (!dateJoined || Number.isNaN(new Date(dateJoined).getTime())) missing.push("Date Joined (valid date)");
    if (!GENDER_VALUES.includes(gender)) missing.push("Gender (MALE/FEMALE/OTHER)");
    if (!REGION_VALUES.includes(region)) missing.push("Region");
    if (!cell(row, houseAddressCol)) missing.push("House Address");
    if (!cell(row, nokNameCol)) missing.push("Next of Kin Name");
    if (!cell(row, nokAddressCol)) missing.push("Next of Kin Address");
    if (!cell(row, nokPhoneCol)) missing.push("Next of Kin Phone");
    if (!MEMBER_TYPE_VALUES.includes(memberType)) missing.push("Member Type (EMPLOYEE/EXTERNAL)");

    if (missing.length > 0) {
      status = "FAILED";
      message = `Missing or invalid: ${missing.join(", ")}.`;
    } else {
      try {
        const member = await createMember(ctx, {
          membershipNumber: membershipNumber || null,
          firstName,
          middleName: cell(row, middleCol) || null,
          lastName,
          gender: gender as "MALE" | "FEMALE" | "OTHER",
          houseAddress: cell(row, houseAddressCol),
          region: region as "SOUTH_WEST" | "LAGOS" | "NORTH_CENTRAL" | "NORTH_EAST" | "SOUTH_SOUTH" | "SOUTH_EAST",
          nextOfKinName: cell(row, nokNameCol),
          nextOfKinAddress: cell(row, nokAddressCol),
          nextOfKinPhone: cell(row, nokPhoneCol),
          memberType: memberType as "EMPLOYEE" | "EXTERNAL",
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
