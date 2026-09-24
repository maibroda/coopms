import { NextRequest, NextResponse } from "next/server";
import { requireApiKey, API_CTX } from "@/lib/auth/apiContext";
import { listMembers, totalSavings } from "@/lib/services/members";
import { db } from "@/lib/db";
import { num, sum } from "@/lib/money";

export async function GET(req: NextRequest) {
  const denied = await requireApiKey(req);
  if (denied) return denied;

  const members = await listMembers(API_CTX);
  const data = await Promise.all(
    members.map(async (m) => {
      const [savings, loans, sales] = await Promise.all([
        totalSavings(m.id),
        db.loan.findMany({ where: { memberId: m.id, status: "ACTIVE" }, select: { outstandingBalance: true } }),
        db.productSale.findMany({ where: { memberId: m.id, status: "ACTIVE" }, select: { outstandingBalance: true } }),
      ]);
      return {
        membershipNumber: m.membershipNumber,
        fullName: m.fullName,
        department: m.department,
        status: m.status,
        monthlyContribution: num(m.monthlyContribution),
        savingsBalance: savings,
        outstandingLoanBalance: sum([num(m.openingLoanBalance), ...loans.map((l) => num(l.outstandingBalance))]),
        outstandingPurchaseBalance: sum(sales.map((s) => num(s.outstandingBalance))),
        bank: { name: m.bankName, accountNumber: m.bankAccountNumber, accountName: m.bankAccountName },
      };
    }),
  );

  return NextResponse.json({ count: data.length, members: data });
}
