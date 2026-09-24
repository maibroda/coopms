import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth/apiContext";
import { db } from "@/lib/db";
import { memberLedger } from "@/lib/services/members";
import { num } from "@/lib/money";
import { iso } from "@/lib/dates";

export async function GET(req: NextRequest, { params }: { params: Promise<{ membershipNumber: string }> }) {
  const denied = await requireApiKey(req);
  if (denied) return denied;

  const { membershipNumber } = await params;
  const member = await db.member.findUnique({ where: { membershipNumber } });
  if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });

  const ledger = await memberLedger(member.id);

  return NextResponse.json({
    membershipNumber: member.membershipNumber,
    fullName: member.fullName,
    department: member.department,
    status: member.status,
    dateJoined: iso(member.dateJoined),
    monthlyContribution: num(member.monthlyContribution),
    bank: { name: member.bankName, accountNumber: member.bankAccountNumber, accountName: member.bankAccountName },
    openingSavingsBalance: ledger.openingSavingsBalance,
    openingLoanBalance: ledger.openingLoanBalance,
    closingSavingsBalance: ledger.closingSavingsBalance,
    closingLoanBalance: ledger.closingLoanBalance,
    statement: ledger.rows.map((r) => ({
      month: iso(r.month),
      savingsIn: r.savingsIn,
      loanGranted: r.loanDisbursed,
      loanRepayment: r.loanRepayment,
      savingsBalance: r.savingsBalance,
      loanBalance: r.loanBalance,
    })),
  });
}
