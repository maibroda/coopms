"use client";
import { useState, useTransition } from "react";
import { setAppropriationRatesAction } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

interface Rates {
  reserveFundRate: number;
  educationFundRate: number;
  dividendRate: number;
  honorariumRate: number;
  meetingExpensesRate: number;
  dividendSavingsRatio: number;
  dividendRepaymentRatio: number;
}

const APPROPRIATION_FIELDS: { key: keyof Rates; label: string }[] = [
  { key: "reserveFundRate", label: "Reserve fund" },
  { key: "educationFundRate", label: "Education fund" },
  { key: "dividendRate", label: "Dividend" },
  { key: "honorariumRate", label: "Honorarium" },
  { key: "meetingExpensesRate", label: "Meeting expenses" },
];

const SPLIT_FIELDS: { key: keyof Rates; label: string }[] = [
  { key: "dividendSavingsRatio", label: "Based on savings" },
  { key: "dividendRepaymentRatio", label: "Based on loan repayments during the year" },
];

export function AppropriationRatesForm({ rates }: { rates: Rates }) {
  const [values, setValues] = useState<Record<keyof Rates, string>>({
    reserveFundRate: String(rates.reserveFundRate * 100),
    educationFundRate: String(rates.educationFundRate * 100),
    dividendRate: String(rates.dividendRate * 100),
    honorariumRate: String(rates.honorariumRate * 100),
    meetingExpensesRate: String(rates.meetingExpensesRate * 100),
    dividendSavingsRatio: String(rates.dividendSavingsRatio * 100),
    dividendRepaymentRatio: String(rates.dividendRepaymentRatio * 100),
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const appropriationSum = APPROPRIATION_FIELDS.reduce((s, f) => s + (Number(values[f.key]) || 0), 0);
  const splitSum = SPLIT_FIELDS.reduce((s, f) => s + (Number(values[f.key]) || 0), 0);

  function set(key: keyof Rates, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const payload: Record<string, number> = {};
      for (const key of Object.keys(values) as (keyof Rates)[]) payload[key] = Number(values[key]) / 100;
      const r = await setAppropriationRatesAction(payload);
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      setSuccess(r.message ?? "Saved.");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">Disposal of surplus — must total 100%</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {APPROPRIATION_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={f.key}>{f.label} %</Label>
              <Input
                id={f.key}
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={values[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <p className={`mt-1 text-xs ${Math.abs(appropriationSum - 100) > 0.05 ? "text-destructive" : "text-muted-foreground"}`}>
          Total: {appropriationSum.toFixed(2)}%
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Dividend pool split — must total 100%</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SPLIT_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={f.key}>{f.label} %</Label>
              <Input
                id={f.key}
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={values[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <p className={`mt-1 text-xs ${Math.abs(splitSum - 100) > 0.05 ? "text-destructive" : "text-muted-foreground"}`}>
          Total: {splitSum.toFixed(2)}%
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        Save policy
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-700">{success}</p>}
    </form>
  );
}
