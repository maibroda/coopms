"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitPaymentClaimAction } from "@/app/actions/paymentClaims";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ReportPaymentForm({ loans }: { loans: { id: string; label: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<"SAVINGS" | "LOAN">("SAVINGS");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const v = Object.fromEntries(fd.entries());
    startTransition(async () => {
      const result = await submitPaymentClaimAction(v);
      if (!result.ok) return setError(result.error ?? "Something went wrong.");
      router.push("/me");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Paid money directly into the cooperative&apos;s bank account — as extra savings, or to pay down (or pay
        off early) a loan? Report it here and the Treasurer will verify it against the bank statement before it&apos;s
        credited to your account.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Payment details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="target">This payment is for</Label>
            <Select id="target" name="target" value={target} onChange={(e) => setTarget(e.target.value as "SAVINGS" | "LOAN")}>
              <option value="SAVINGS">Extra savings</option>
              <option value="LOAN">A loan repayment</option>
            </Select>
          </div>
          {target === "LOAN" && (
            <div className="space-y-1">
              <Label htmlFor="loanId">Which loan</Label>
              <Select id="loanId" name="loanId" required={target === "LOAN"}>
                <option value="">Select a loan…</option>
                {loans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
              {loans.length === 0 && <p className="text-xs text-destructive">You have no active loans.</p>}
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="amount">Amount (₦)</Label>
            <Input id="amount" name="amount" type="number" min="0" step="0.01" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="paidOn">Date paid</Label>
            <Input id="paidOn" name="paidOn" type="date" required />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="reference">Bank transfer / teller reference</Label>
            <Input id="reference" name="reference" required placeholder="e.g. transfer reference or teller number" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" name="note" />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Report payment"}
      </Button>
    </form>
  );
}
