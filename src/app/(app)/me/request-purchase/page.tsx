import { redirect } from "next/navigation";
import { requirePage } from "@/lib/auth/session";
import { checkPurchaseEligibility } from "@/lib/services/sales";
import { RequestSaleForm } from "@/components/forms/request-sale-form";

export default async function RequestPurchasePage() {
  const ctx = await requirePage("self.request");
  if (!ctx.memberId) redirect("/me");
  const eligibility = await checkPurchaseEligibility(ctx.memberId);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Request a purchase</h1>
      <RequestSaleForm eligibility={eligibility} />
    </div>
  );
}
