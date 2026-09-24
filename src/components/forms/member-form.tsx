"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMemberAction, updateMemberAction } from "@/app/actions/members";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface MemberFormValues {
  id?: string;
  membershipNumber?: string;
  fullName?: string;
  department?: string;
  employeeNumber?: string;
  dateJoined?: string;
  monthlyContribution?: number;
  phone?: string;
  email?: string;
  openingSavingsBalance?: number;
  openingLoanBalance?: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
}

export function MemberForm({ initial }: { initial?: MemberFormValues }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const v = Object.fromEntries(fd.entries());
    startTransition(async () => {
      const result = initial?.id ? await updateMemberAction(initial.id, v) : await createMemberAction(v);
      if (!result.ok) return setError(result.error ?? "Something went wrong.");
      router.push(result.redirectTo ?? "/members");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Member details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="membershipNumber">Membership number (leave blank to auto-generate)</Label>
            <Input id="membershipNumber" name="membershipNumber" defaultValue={initial?.membershipNumber} disabled={!!initial?.id} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" name="fullName" required defaultValue={initial?.fullName} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="department">Department</Label>
            <Input id="department" name="department" defaultValue={initial?.department} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="employeeNumber">Employee number</Label>
            <Input id="employeeNumber" name="employeeNumber" defaultValue={initial?.employeeNumber} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dateJoined">Date joined</Label>
            <Input id="dateJoined" name="dateJoined" type="date" required defaultValue={initial?.dateJoined} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="monthlyContribution">Monthly contribution (₦)</Label>
            <Input id="monthlyContribution" name="monthlyContribution" type="number" min="0" step="0.01" required defaultValue={initial?.monthlyContribution} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={initial?.phone} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={initial?.email} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="openingSavingsBalance">Opening savings balance (₦, carried forward)</Label>
            <Input id="openingSavingsBalance" name="openingSavingsBalance" type="number" min="0" step="0.01" defaultValue={initial?.openingSavingsBalance ?? 0} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="openingLoanBalance">Opening loan balance (₦, carried forward)</Label>
            <Input id="openingLoanBalance" name="openingLoanBalance" type="number" min="0" step="0.01" defaultValue={initial?.openingLoanBalance ?? 0} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank details</CardTitle>
          <p className="text-xs text-muted-foreground">Used for loan disbursement and (later) dividend payments.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="bankName">Bank name</Label>
            <Input id="bankName" name="bankName" defaultValue={initial?.bankName} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bankAccountNumber">Account number</Label>
            <Input id="bankAccountNumber" name="bankAccountNumber" defaultValue={initial?.bankAccountNumber} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bankAccountName">Account name</Label>
            <Input id="bankAccountName" name="bankAccountName" defaultValue={initial?.bankAccountName} />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : initial?.id ? "Save changes" : "Create member"}
      </Button>
    </form>
  );
}
