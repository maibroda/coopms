"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSaleAction } from "@/app/actions/sales";
import { calcProductSale } from "@/lib/calc";
import { naira } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExceptionField } from "@/components/forms/exception-field";
import type { PurchaseEligibility } from "@/lib/services/sales";

export function SaleForm({
  members,
  defaultMemberId,
  initialEligibility,
}: {
  members: { id: string; label: string }[];
  defaultMemberId?: string;
  initialEligibility: PurchaseEligibility | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [cost, setCost] = useState("");
  const [rate, setRate] = useState("");
  const [duration, setDuration] = useState("");

  const preview = useMemo(() => {
    const c = Number(cost),
      d = Number(duration);
    if (!c || !d) return null;
    return calcProductSale(c, Number(rate) || 0, d);
  }, [cost, rate, duration]);

  const exceedsEligibility = initialEligibility && Number(cost) > initialEligibility.availableCapacity;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const v = Object.fromEntries(fd.entries());
    startTransition(async () => {
      const result = await createSaleAction(v);
      if (!result.ok) return setError(result.error ?? "Something went wrong.");
      router.push("/sales");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Purchase details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="memberId">Member</Label>
            <Select id="memberId" name="memberId" required defaultValue={defaultMemberId}>
              <option value="">Select a member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="itemName">Item</Label>
            <Input id="itemName" name="itemName" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="category">Category</Label>
            <Select id="category" name="category" defaultValue="OTHER">
              <option value="PHONE">Phone</option>
              <option value="LAPTOP">Laptop</option>
              <option value="FOOD">Food item</option>
              <option value="APPLIANCE">Home appliance</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cost">Cost (₦)</Label>
            <Input id="cost" name="cost" type="number" min="0" step="0.01" required value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="interestRate">Interest rate (%)</Label>
            <Input id="interestRate" name="interestRate" type="number" min="0" step="0.01" required value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="durationMonths">Duration (months)</Label>
            <Input id="durationMonths" name="durationMonths" type="number" min="1" step="1" required value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="startMonth">Start month</Label>
            <Input id="startMonth" name="startMonth" type="month" required />
          </div>
        </CardContent>
      </Card>

      {initialEligibility && (
        <p className="text-sm text-muted-foreground">
          Savings can accommodate up to <strong>{naira(initialEligibility.availableCapacity)}</strong> more in credit purchases.
        </p>
      )}
      <ExceptionField exceeds={!!exceedsEligibility} />

      {preview && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
            <Stat label="Total interest" value={naira(preview.totalInterest)} />
            <Stat label="Total repayment" value={naira(preview.totalRepayment)} />
            <Stat label="Monthly deduction" value={naira(preview.monthlyRepayment)} />
            <Stat label="Installments" value={String(preview.schedule.length)} />
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Record purchase"}
      </Button>
    </form>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
