"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLoanAction } from "@/app/actions/loans";
import { calcLoan } from "@/lib/calc";
import { naira } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExceptionField } from "@/components/forms/exception-field";
import type { EligibilityResult } from "@/lib/services/loans";

export interface LoanProductOption {
  id: string;
  name: string;
  interestRate: number;
  durationMonths: number;
  repaymentType: "FLAT" | "REDUCING";
}

export function LoanForm({
  members,
  defaultMemberId,
  initialEligibility,
  loanProducts = [],
}: {
  members: { id: string; label: string }[];
  defaultMemberId?: string;
  initialEligibility: EligibilityResult | null;
  loanProducts?: LoanProductOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [duration, setDuration] = useState("");
  const [type, setType] = useState<"FLAT" | "REDUCING">("FLAT");

  function applyProduct(id: string) {
    const p = loanProducts.find((p) => p.id === id);
    if (!p) return;
    setRate(String(p.interestRate));
    setDuration(String(p.durationMonths));
    setType(p.repaymentType);
  }

  const preview = useMemo(() => {
    const p = Number(amount),
      r = Number(rate),
      d = Number(duration);
    if (!p || !d) return null;
    return calcLoan(p, r || 0, d, type);
  }, [amount, rate, duration, type]);

  const exceedsEligibility = initialEligibility && Number(amount) > initialEligibility.availableToBorrow;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const v = Object.fromEntries(fd.entries());
    startTransition(async () => {
      const result = await createLoanAction(v);
      if (!result.ok) return setError(result.error ?? "Something went wrong.");
      router.push("/loans");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Loan details</CardTitle>
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
          {loanProducts.length > 0 && (
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="loanProduct">Loan product (optional preset)</Label>
              <Select id="loanProduct" onChange={(e) => applyProduct(e.target.value)} defaultValue="">
                <option value="">Custom — fill in manually</option>
                {loanProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.interestRate}% / {p.durationMonths}mo ({p.repaymentType})
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="loanAmount">Loan amount (₦)</Label>
            <Input id="loanAmount" name="loanAmount" type="number" min="0" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
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
            <Label htmlFor="repaymentType">Repayment type</Label>
            <Select id="repaymentType" name="repaymentType" value={type} onChange={(e) => setType(e.target.value as "FLAT" | "REDUCING")}>
              <option value="FLAT">Flat</option>
              <option value="REDUCING">Reducing balance</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="startMonth">Start month</Label>
            <Input id="startMonth" name="startMonth" type="month" required />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" name="note" />
          </div>
        </CardContent>
      </Card>

      {initialEligibility && (
        <p className="text-sm text-muted-foreground">
          Eligible to borrow up to <strong>{naira(initialEligibility.availableToBorrow)}</strong> (cap of {naira(initialEligibility.maxBorrowable)}, less existing loan principal).
        </p>
      )}
      <ExceptionField exceeds={!!exceedsEligibility} />

      {preview && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
            <Stat label="Total interest" value={naira(preview.totalInterest)} />
            <Stat label="Total repayment" value={naira(preview.totalRepayment)} />
            <Stat label="Monthly repayment" value={naira(preview.monthlyRepayment)} />
            <Stat label="Installments" value={String(preview.schedule.length)} />
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create loan"}
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
