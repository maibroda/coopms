"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSettingsAction } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Settings } from "@/lib/services/settings";

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const v = Object.fromEntries(fd.entries());
    startTransition(async () => {
      const result = await updateSettingsAction(v);
      if (!result.ok) return setError(result.error ?? "Something went wrong.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="orgName">Organization name</Label>
            <Input id="orgName" name="orgName" required defaultValue={settings.orgName} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="logoUrl">Logo URL (optional)</Label>
            <Input id="logoUrl" name="logoUrl" defaultValue={settings.logoUrl ?? ""} placeholder="https://…" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="currencySymbol">Currency symbol</Label>
            <Input id="currencySymbol" name="currencySymbol" required defaultValue={settings.currencySymbol} className="w-24" />
            <p className="text-xs text-muted-foreground">
              Stored for future use — amounts are currently always shown in ₦ throughout the app.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="loanEligibilityMultiplier">Loan eligibility multiplier</Label>
            <Input
              id="loanEligibilityMultiplier"
              name="loanEligibilityMultiplier"
              type="number"
              min="0.1"
              step="0.1"
              required
              defaultValue={settings.loanEligibilityMultiplier}
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">
              A member may borrow up to this many times their savings (1.5 = 150%, the default).
            </p>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
