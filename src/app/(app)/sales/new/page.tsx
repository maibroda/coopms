import { requirePage } from "@/lib/auth/session";
import { listMembers } from "@/lib/services/members";
import { checkPurchaseEligibility } from "@/lib/services/sales";
import { SaleForm } from "@/components/forms/sale-form";

export default async function NewSalePage({ searchParams }: { searchParams: Promise<{ memberId?: string }> }) {
  const ctx = await requirePage("sale.manage");
  const { memberId } = await searchParams;
  const members = await listMembers(ctx, { status: "ACTIVE" });
  const eligibility = memberId ? await checkPurchaseEligibility(memberId) : null;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">New product purchase</h1>
      <SaleForm
        members={members.map((m) => ({ id: m.id, label: `${m.membershipNumber} — ${m.fullName}` }))}
        defaultMemberId={memberId}
        initialEligibility={eligibility}
      />
    </div>
  );
}
