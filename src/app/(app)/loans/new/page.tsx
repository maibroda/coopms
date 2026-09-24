import { requirePage } from "@/lib/auth/session";
import { listMembers } from "@/lib/services/members";
import { checkLoanEligibility } from "@/lib/services/loans";
import { listLoanProducts } from "@/lib/services/settings";
import { num } from "@/lib/money";
import { LoanForm } from "@/components/forms/loan-form";

export default async function NewLoanPage({ searchParams }: { searchParams: Promise<{ memberId?: string }> }) {
  const ctx = await requirePage("loan.manage");
  const { memberId } = await searchParams;
  const [members, products] = await Promise.all([listMembers(ctx, { status: "ACTIVE" }), listLoanProducts()]);
  const eligibility = memberId ? await checkLoanEligibility(memberId) : null;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">New loan</h1>
      <LoanForm
        members={members.map((m) => ({ id: m.id, label: `${m.membershipNumber} — ${m.fullName}` }))}
        defaultMemberId={memberId}
        initialEligibility={eligibility}
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
