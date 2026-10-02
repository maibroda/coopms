"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMemberAction, updateMemberAction } from "@/app/actions/members";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

export const REGION_OPTIONS = [
  { value: "SOUTH_WEST", label: "South West" },
  { value: "LAGOS", label: "Lagos" },
  { value: "NORTH_CENTRAL", label: "North Central" },
  { value: "NORTH_EAST", label: "North East" },
  { value: "SOUTH_SOUTH", label: "South South" },
  { value: "SOUTH_EAST", label: "South East" },
];

export const MEMBER_TYPE_OPTIONS = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "EXTERNAL", label: "External member" },
];

export interface MemberFormValues {
  id?: string;
  membershipNumber?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  gender?: string;
  houseAddress?: string;
  region?: string;
  nextOfKinName?: string;
  nextOfKinAddress?: string;
  nextOfKinPhone?: string;
  memberType?: string;
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
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" required defaultValue={initial?.firstName} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="middleName">Middle name</Label>
            <Input id="middleName" name="middleName" defaultValue={initial?.middleName} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" required defaultValue={initial?.lastName} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gender">Gender</Label>
            <Select id="gender" name="gender" required defaultValue={initial?.gender ?? ""}>
              <option value="" disabled>Select…</option>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="memberType">Member type</Label>
            <Select id="memberType" name="memberType" required defaultValue={initial?.memberType ?? "EMPLOYEE"}>
              {MEMBER_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="region">Region</Label>
            <Select id="region" name="region" required defaultValue={initial?.region ?? ""}>
              <option value="" disabled>Select…</option>
              {REGION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="houseAddress">House address</Label>
            <Input id="houseAddress" name="houseAddress" required defaultValue={initial?.houseAddress} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="department">Department</Label>
            <Input id="department" name="department" defaultValue={initial?.department} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="employeeNumber">Employee number (external members can leave blank)</Label>
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
          <CardTitle>Next of kin</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="nextOfKinName">Name</Label>
            <Input id="nextOfKinName" name="nextOfKinName" required defaultValue={initial?.nextOfKinName} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nextOfKinAddress">Address</Label>
            <Input id="nextOfKinAddress" name="nextOfKinAddress" required defaultValue={initial?.nextOfKinAddress} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nextOfKinPhone">Phone number</Label>
            <Input id="nextOfKinPhone" name="nextOfKinPhone" required defaultValue={initial?.nextOfKinPhone} />
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
