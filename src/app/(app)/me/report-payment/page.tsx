import { redirect } from "next/navigation";
import { requirePage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { naira } from "@/lib/money";
import { ReportPaymentForm } from "@/components/forms/report-payment-form";

export default async function ReportPaymentPage() {
  const ctx = await requirePage("self.request");
  if (!ctx.memberId) redirect("/me");
  const loans = await db.loan.findMany({ where: { memberId: ctx.memberId, status: "ACTIVE" } });

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Report a direct payment</h1>
      <ReportPaymentForm loans={loans.map((l) => ({ id: l.id, label: `${naira(l.loanAmount)} loan — outstanding ${naira(l.outstandingBalance)}` }))} />
    </div>
  );
}
