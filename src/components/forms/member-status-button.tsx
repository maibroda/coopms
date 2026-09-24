"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMemberStatusAction } from "@/app/actions/members";
import { naira } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function MemberStatusButton({
  memberId,
  status,
  outstandingLoans,
  outstandingPurchases,
  netPayout,
}: {
  memberId: string;
  status: "ACTIVE" | "INACTIVE";
  outstandingLoans: number;
  outstandingPurchases: number;
  netPayout: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(confirmed: boolean) {
    setError(null);
    startTransition(async () => {
      const target = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const r = await setMemberStatusAction(memberId, target, confirmed);
      if (!r.ok) {
        setError(r.error ?? "Something went wrong.");
        if (target === "INACTIVE" && !confirmed) setConfirming(true);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  if (status === "INACTIVE") {
    return (
      <Button variant="outline" disabled={pending} onClick={() => run(true)}>
        {pending ? "Reactivating…" : "Reactivate member"}
      </Button>
    );
  }

  if (confirming) {
    const hasOutstanding = outstandingLoans > 0 || outstandingPurchases > 0;
    return (
      <Card className="border-destructive/40">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm">{error}</p>
          {hasOutstanding && (
            <p className="text-sm text-muted-foreground">
              Net payout if settled today: <strong>{naira(netPayout)}</strong> (savings less outstanding loans and
              purchases).
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="destructive" disabled={pending} onClick={() => run(true)}>
              {pending ? "Deactivating…" : "Deactivate anyway"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Button variant="outline" disabled={pending} onClick={() => run(false)}>
      Deactivate member
    </Button>
  );
}
