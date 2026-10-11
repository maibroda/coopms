"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { declareOrRecomputeDraftAction } from "@/app/actions/dividends";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DividendDeclarationForm({ existingYears }: { existingYears: number[] }) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [declaredSurplus, setDeclaredSurplus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const alreadyExists = existingYears.includes(Number(year));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await declareOrRecomputeDraftAction(Number(year), Number(declaredSurplus));
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      router.push(r.redirectTo ?? "/dividends");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Declare a year&apos;s surplus</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">
          Enter the audited surplus figure for the year — coopms has no general ledger of its own, so this comes from wherever
          the cooperative&apos;s accounts are prepared. The appropriation split and per-member dividend are computed automatically
          from here, using the rates in Organization Settings and each member&apos;s real savings and loan-repayment history.
        </p>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="year">Financial year</Label>
            <Input id="year" type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(e.target.value)} className="w-28" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="declaredSurplus">Declared surplus (₦)</Label>
            <Input
              id="declaredSurplus"
              type="number"
              min="0"
              step="0.01"
              value={declaredSurplus}
              onChange={(e) => setDeclaredSurplus(e.target.value)}
              className="w-48"
              required
            />
          </div>
          <Button type="submit" disabled={pending || !declaredSurplus}>
            {alreadyExists ? "Recompute draft" : "Compute declaration"}
          </Button>
        </form>
        {alreadyExists && (
          <p className="text-xs text-amber-700">
            {year} already has a declaration. Submitting will recompute it from scratch — unless it&apos;s already approved, in which
            case this will be refused.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
