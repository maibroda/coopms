import { redirect } from "next/navigation";
import { requirePage } from "@/lib/auth/session";
import { checkLoanEligibility } from "@/lib/services/loans";
import { listLoanProducts } from "@/lib/services/settings";
import { num } from "@/lib/money";
import { RequestLoanForm } from "@/components/forms/request-loan-form";

export default async function RequestLoanPage() {
  const ctx = await requirePage("self.request");
  if (!ctx.memberId) redirect("/me");
  const [eligibility, products] = await Promise.all([checkLoanEligibility(ctx.memberId), listLoanProducts()]);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Request a loan</h1>
      <RequestLoanForm
        eligibility={eligibility}
        loanProducts={products.map((p) => ({
          id: p.id,
          name: p.name,
          interestRate: num(p.interestRate),
          durationMonths: p.durationMonths,
          repaymentType: p.repaymentType,
        }))}
      />
    </div>
  );
}
