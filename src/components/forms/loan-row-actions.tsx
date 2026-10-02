"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  suspendLoanAction,
  resumeLoanAction,
  markLoanStatusAction,
  recordManualLoanRepaymentAction,
  restructureLoanAction,
  adjustLoanAction,
  recomputeEarlyPayoffAction,
} from "@/app/actions/loans";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { MonthDropdown } from "@/components/month-dropdown";
import { toMonthInput } from "@/lib/dates";

export function LoanRowActions({
  loanId,
  memberId,
  suspended,
  status,
  isAdmin = false,
  current,
}: {
  loanId: string;
  memberId: string;
  suspended: boolean;
  status: string;
  isAdmin?: boolean;
  current?: { loanAmount: number; interestRate: number; durationMonths: number; repaymentType: string; startMonth: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showSuspend, setShowSuspend] = useState(false);
  const [showRepay, setShowRepay] = useState(false);
  const [showRestructure, setShowRestructure] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [from, setFrom] = useState(toMonthInput(new Date()));
  const [until, setUntil] = useState(toMonthInput(new Date()));
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [reference, setReference] = useState("");
  const [rate, setRate] = useState("");
  const [duration, setDuration] = useState("");
  const [type, setType] = useState<"FLAT" | "REDUCING">("FLAT");
  const [startMonth, setStartMonth] = useState(toMonthInput(new Date()));
  const [adjAmount, setAdjAmount] = useState(String(current?.loanAmount ?? ""));
  const [adjRate, setAdjRate] = useState(String(current?.interestRate ?? ""));
  const [adjDuration, setAdjDuration] = useState(String(current?.durationMonths ?? ""));
  const [adjType, setAdjType] = useState<"FLAT" | "REDUCING">((current?.repaymentType as "FLAT" | "REDUCING") ?? "FLAT");
  const [adjStartMonth, setAdjStartMonth] = useState(current?.startMonth ?? toMonthInput(new Date()));
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      setShowRepay(false);
      setShowSuspend(false);
      setShowRestructure(false);
      setShowAdjust(false);
      router.refresh();
    });
  }

  const canAdjust = status === "ACTIVE" || (status === "PENDING" && isAdmin);

  // A PENDING loan hasn't been approved yet, so none of the active-loan actions (repayment,
  // suspend, restructure, early payoff) apply — but an Admin can still correct its terms before
  // it's reviewed, same as for an active loan, via the same adjustLoan service call.
  if (status === "PENDING" && !showAdjust) {
    if (!isAdmin) return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <div className="flex flex-col items-start gap-1">
        <Button size="sm" variant="outline" onClick={() => setShowAdjust(true)}>
          Admin adjust
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (status !== "ACTIVE" && !canAdjust) return <span className="text-xs text-muted-foreground">—</span>;

  if (showAdjust && canAdjust) {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <Input type="number" min="0" step="0.01" placeholder="Amount" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} className="h-8 w-24 text-xs" />
          <Input type="number" min="0" step="0.01" placeholder="Rate %" value={adjRate} onChange={(e) => setAdjRate(e.target.value)} className="h-8 w-20 text-xs" />
          <Input type="number" min="1" step="1" placeholder="Months" value={adjDuration} onChange={(e) => setAdjDuration(e.target.value)} className="h-8 w-20 text-xs" />
          <Select value={adjType} onChange={(e) => setAdjType(e.target.value as "FLAT" | "REDUCING")} className="h-8 w-28 text-xs">
            <option value="FLAT">Flat</option>
            <option value="REDUCING">Reducing</option>
          </Select>
          <MonthDropdown value={adjStartMonth} onChange={setAdjStartMonth} />
          <Button
            size="sm"
            disabled={pending || !adjAmount || !adjRate || !adjDuration || !adjStartMonth}
            onClick={() =>
              run(() =>
                adjustLoanAction(loanId, memberId, {
                  loanAmount: adjAmount,
                  interestRate: adjRate,
                  durationMonths: adjDuration,
                  repaymentType: adjType,
                  startMonth: `${adjStartMonth}-01`,
                }),
              )
            }
          >
            Save correction
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowAdjust(false)}>
            Cancel
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Corrects the loan&apos;s terms in place — recomputes the full schedule from these values and nets off whatever has already been repaid.
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
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
          <MonthDropdown value={startMonth} onChange={setStartMonth} />
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
          <MonthDropdown value={from} onChange={setFrom} />
          <MonthDropdown value={until} onChange={setUntil} />
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
          variant="outline"
          disabled={pending}
          onClick={() => run(() => recomputeEarlyPayoffAction(loanId, memberId))}
          title="Recompute the balance for part-payment or liquidation before term end — rebates interest not yet accrued."
        >
          Recompute for early payoff
        </Button>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setShowAdjust(true)}>
            Admin adjust
          </Button>
        )}
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
