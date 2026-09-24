"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordSaleRepaymentAction } from "@/app/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SaleRowActions({ saleId, memberId, status }: { saleId: string; memberId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showRepay, setShowRepay] = useState(false);
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (status !== "ACTIVE") return <span className="text-xs text-muted-foreground">—</span>;

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await recordSaleRepaymentAction(saleId, memberId, { amount, paidOn, reference });
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      setShowRepay(false);
      router.refresh();
    });
  }

  if (showRepay) {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <Input type="number" min="0" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 w-24 text-xs" />
          <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="h-8 w-32 text-xs" />
          <Input placeholder="Reference" value={reference} onChange={(e) => setReference(e.target.value)} className="h-8 w-24 text-xs" />
          <Button size="sm" disabled={pending || !amount || !paidOn} onClick={submit}>
            Record
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowRepay(false)}>
            Cancel
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <Button size="sm" onClick={() => setShowRepay(true)}>
      Record repayment
    </Button>
  );
}
