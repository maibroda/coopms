import { redirect } from "next/navigation";
import { requirePage } from "@/lib/auth/session";
import { checkPurchaseEligibility } from "@/lib/services/sales";
import { getCachedSettings } from "@/lib/services/settings";
import { RequestSaleForm } from "@/components/forms/request-sale-form";
import { Card, CardContent } from "@/components/ui/card";

export default async function RequestPurchasePage() {
  const ctx = await requirePage("self.request");
  if (!ctx.memberId) redirect("/me");
  const [eligibility, settings] = await Promise.all([checkPurchaseEligibility(ctx.memberId), getCachedSettings()]);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Request a purchase</h1>
      {settings.productSalesOpen ? (
        <RequestSaleForm eligibility={eligibility} />
      ) : (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Product Sales is currently closed — new purchases aren&apos;t being accepted outside the sales period.
            Check back once it reopens.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
