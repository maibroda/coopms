"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { suspendLoanAction, resumeLoanAction, markLoanStatusAction, recordManualLoanRepaymentAction, restructureLoanAction } from "@/app/actions/loans";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export function LoanRowActions({
  loanId,
  memberId,
  suspended,
  status,
}: {
  loanId: string;
  memberId: string;
  suspended: boolean;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showSuspend, setShowSuspend] = useState(false);
  const [showRepay, setShowRepay] = useState(false);
  const [showRestructure, setShowRestructure] = useState(false);
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [reference, setReference] = useState("");
  const [rate, setRate] = useState("");
  const [duration, setDuration] = useState("");
  const [type, setType] = useState<"FLAT" | "REDUCING">("FLAT");
  const [startMonth, setStartMonth] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (status !== "ACTIVE") return <span className="text-xs text-muted-foreground">—</span>;

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      setShowRepay(false);
      setShowSuspend(false);
      setShowRestructure(false);
      router.refresh();
    });
  }

  if (showRestructure) {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <Input type="number" min="0" step="0.01" placeholder="Rate %" value={rate} onChange={(e) => setRate(e.target.value)} className="h-8 w-20 text-xs" />
          <Input type="number" min="1" step="1" placeholder="Months" value={duration} onChange={(e) => setDuration(e.target.value)} className="h-8 w-20 text-xs" />
          <Select value={type} onChange={(e) => setType(e.target.value as "FLAT" | "REDUCING")} className="h-8 w-28 text-xs">
            <option value="FLAT">Flat</option>
            <option value="REDUCING">Reducing</option>
          </Select>
          <Input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className="h-8 w-28 text-xs" />
          <Button
            size="sm"
            disabled={pending || !rate || !duration || !startMonth}
            onClick={() =>
              run(() => restructureLoanAction(loanId, memberId, { interestRate: rate, durationMonths: duration, repaymentType: type, startMonth: `${startMonth}-01` }))
            }
          >
            Confirm
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowRestructure(false)}>
            Cancel
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">The remaining balance becomes the new loan&apos;s principal under these terms.</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (showRepay) {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <Input type="number" min="0" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 w-24 text-xs" />
          <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="h-8 w-32 text-xs" />
          <Input placeholder="Reference" value={reference} onChange={(e) => setReference(e.target.value)} className="h-8 w-24 text-xs" />
          <Button
            size="sm"
            disabled={pending || !amount || !paidOn}
            onClick={() => run(() => recordManualLoanRepaymentAction(loanId, memberId, { amount, paidOn, reference }))}
          >
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

  if (suspended) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => resumeLoanAction(loanId, memberId))}>
          Resume now
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (showSuspend) {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-1">
          <Input type="month" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-28 text-xs" />
          <Input type="month" value={until} onChange={(e) => setUntil(e.target.value)} className="h-8 w-28 text-xs" />
          <Button
            size="sm"
            disabled={pending || !from || !until}
            onClick={() => run(() => suspendLoanAction(loanId, memberId, `${from}-01`, `${until}-01`))}
          >
            Confirm
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowSuspend(false)}>
            Cancel
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-1">
        <Button size="sm" onClick={() => setShowRepay(true)}>
          Record repayment
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowSuspend(true)}>
          Suspend
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowRestructure(true)}>
          Restructure
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => markLoanStatusAction(loanId, memberId, "DEFAULTED"))}
        >
          Mark defaulted
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
