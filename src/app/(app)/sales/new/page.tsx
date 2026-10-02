import { requirePage } from "@/lib/auth/session";
import { listMembers } from "@/lib/services/members";
import { checkPurchaseEligibility } from "@/lib/services/sales";
import { getCachedSettings } from "@/lib/services/settings";
import { SaleForm } from "@/components/forms/sale-form";
import { Card, CardContent } from "@/components/ui/card";

export default async function NewSalePage({ searchParams }: { searchParams: Promise<{ memberId?: string }> }) {
  const ctx = await requirePage("sale.manage");
  const { memberId } = await searchParams;
  const [members, settings] = await Promise.all([listMembers(ctx, { status: "ACTIVE" }), getCachedSettings()]);
  const eligibility = memberId ? await checkPurchaseEligibility(memberId) : null;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">New product purchase</h1>
      {settings.productSalesOpen ? (
        <SaleForm
          members={members.map((m) => ({ id: m.id, label: `${m.membershipNumber} — ${m.fullName}` }))}
          defaultMemberId={memberId}
          initialEligibility={eligibility}
        />
      ) : (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Product Sales is currently closed. Open it from Organization Settings before creating a new purchase.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
