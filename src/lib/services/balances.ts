import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { round2 } from "@/lib/money";
import { logAudit } from "./auditLog";
import type { Ctx } from "@/lib/auth/context";
import { can, ForbiddenError } from "@/lib/auth/permissions";

function requirePerm(ctx: Ctx) {
  if (!can(ctx.role, "member.manage")) throw new ForbiddenError("member.manage");
}

export async function generateBalanceTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Balances");
  ws.columns = [
    { header: "ID No", key: "id", width: 16 },
    { header: "Names", key: "name", width: 28 },
    { header: "Code", key: "code", width: 12 },
    { header: "Amount", key: "amount", width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.addRow({ id: "MEM-000001", name: "John Doe", code: "SAVINGS", amount: 150000 });
  ws.addRow({ id: "MEM-000001", name: "John Doe", code: "LOAN", amount: 0 });
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export interface BalanceImportRowResult {
  rowNumber: number;
  membershipNumber: string;
  fullNameInFile: string;
  code: string;
  amount: number;
  status: "APPLIED" | "FAILED";
  message: string | null;
}

export interface BalanceImportResult {
  importId: string;
  total: number;
  applied: number;
  failed: number;
  rows: BalanceImportRowResult[];
}

/**
 * Bulk-loads opening savings/loan balances brought forward from manual records. Each row SETS
 * the member's opening balance for that code (not additive) — re-uploading a corrected file is
 * how you fix a mistake, matching how a one-time migration import is normally used.
 */
export async function importBalances(ctx: Ctx, fileName: string, buffer: Buffer): Promise<BalanceImportResult> {
  requirePerm(ctx);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("The uploaded file has no worksheet.");

  // ExcelJS Row.values is 1-indexed (index 0 is a hole); Array.from fills holes as undefined
  // instead of silently skipping them the way .map() would, which findIndex below would not expect.
  const headerRow = ws.getRow(1).values as unknown[];
  const headers = Array.from(headerRow, (h) => String(h ?? "").trim().toLowerCase());
  const idCol = headers.findIndex((h) => h.includes("id"));
  const nameCol = headers.findIndex((h) => h.includes("name"));
  const codeCol = headers.findIndex((h) => h.includes("code"));
  const amountCol = headers.findIndex((h) => h.includes("amount"));
  if (idCol < 0 || codeCol < 0 || amountCol < 0) {
    throw new Error("Could not find the ID No, Code and Amount columns. Use the provided template.");
  }

  const results: BalanceImportRowResult[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (row.cellCount === 0) continue;
    const membershipNumber = String(row.getCell(idCol).value ?? "").trim();
    if (!membershipNumber) continue;
    const fullNameInFile = nameCol >= 0 ? String(row.getCell(nameCol).value ?? "").trim() : "";
    const codeRaw = String(row.getCell(codeCol).value ?? "").trim().toUpperCase();
    const amountRaw = row.getCell(amountCol).value;
    const amount = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);

    let status: "APPLIED" | "FAILED" = "APPLIED";
    let message: string | null = null;

    if (codeRaw !== "SAVINGS" && codeRaw !== "LOAN") {
      status = "FAILED";
      message = `Code must be SAVINGS or LOAN, got "${codeRaw}".`;
    } else if (!Number.isFinite(amount) || amount < 0) {
      status = "FAILED";
      message = "Amount must be a non-negative number.";
    } else {
      const member = await db.member.findUnique({ where: { membershipNumber } });
      if (!member) {
        status = "FAILED";
        message = `No member found with ID ${membershipNumber}.`;
      } else {
        if (codeRaw === "SAVINGS") {
          await db.member.update({ where: { id: member.id }, data: { openingSavingsBalance: round2(amount) } });
        } else {
          await db.member.update({ where: { id: member.id }, data: { openingLoanBalance: round2(amount) } });
        }
        if (fullNameInFile && fullNameInFile.toLowerCase() !== member.fullName.toLowerCase()) {
          message = `Applied, but name in file ("${fullNameInFile}") differs from record ("${member.fullName}").`;
        }
      }
    }

    results.push({ rowNumber: r, membershipNumber, fullNameInFile, code: codeRaw, amount: round2(amount || 0), status, message });
  }

  const applied = results.filter((r) => r.status === "APPLIED").length;
  const failed = results.length - applied;

  const batch = await db.balanceImport.create({
    data: {
      fileName,
      importedById: ctx.userId,
      rows: {
        create: results.map((r) => ({
          rowNumber: r.rowNumber,
          membershipNumber: r.membershipNumber,
          fullNameInFile: r.fullNameInFile || null,
          code: r.code === "LOAN" ? "LOAN" : "SAVINGS",
          amount: r.amount,
          status: r.status,
          message: r.message,
        })),
      },
    },
  });

  await logAudit(ctx, {
    action: "BALANCE_IMPORT",
    entityType: "BalanceImport",
    entityId: batch.id,
    after: { fileName, total: results.length, applied, failed },
  });

  return { importId: batch.id, total: results.length, applied, failed, rows: results };
}

export async function listBalanceImports(ctx: Ctx) {
  requirePerm(ctx);
  return db.balanceImport.findMany({
    orderBy: { createdAt: "desc" },
    include: { rows: true },
    take: 20,
  });
}
