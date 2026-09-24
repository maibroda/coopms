"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLoanProductAction, setLoanProductActiveAction } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

export function AddLoanProductForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const v = Object.fromEntries(fd.entries());
    startTransition(async () => {
      const result = await createLoanProductAction(v);
      if (!result.ok) return setError(result.error ?? "Something went wrong.");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="name">Product name</Label>
        <Input id="name" name="name" required placeholder="Emergency Loan" className="w-48" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="interestRate">Rate (%)</Label>
        <Input id="interestRate" name="interestRate" type="number" min="0" step="0.01" required className="w-24" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="durationMonths">Duration (months)</Label>
        <Input id="durationMonths" name="durationMonths" type="number" min="1" step="1" required className="w-24" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="repaymentType">Type</Label>
        <Select id="repaymentType" name="repaymentType" defaultValue="FLAT" className="w-32">
          <option value="FLAT">Flat</option>
          <option value="REDUCING">Reducing</option>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add product"}
      </Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}

export function ToggleLoanProductButton({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setLoanProductActiveAction(id, !isActive);
          router.refresh();
        })
      }
    >
      {pending ? "…" : isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}
