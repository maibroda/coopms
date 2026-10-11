"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveDeclarationAction, deleteDraftDeclarationAction } from "@/app/actions/dividends";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function DeclarationActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmingApprove, setConfirmingApprove] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "APPROVED") return <span className="text-xs text-muted-foreground">Locked</span>;

  function approve() {
    setError(null);
    startTransition(async () => {
      const r = await approveDeclarationAction(id);
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      setConfirmingApprove(false);
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const r = await deleteDraftDeclarationAction(id);
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      router.push("/dividends");
      router.refresh();
    });
  }

  if (confirmingApprove) {
    return (
      <Card className="border-amber-400/50">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <p className="text-sm">Approve and lock this declaration? It can no longer be recomputed or deleted afterward.</p>
          <Button size="sm" disabled={pending} onClick={approve}>
            {pending ? "Approving…" : "Yes, approve"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmingApprove(false)}>
            Cancel
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (confirmingDelete) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <p className="text-sm">Delete this draft declaration? This cannot be undone.</p>
          <Button size="sm" variant="destructive" disabled={pending} onClick={remove}>
            {pending ? "Deleting…" : "Yes, delete"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" disabled={pending} onClick={() => setConfirmingApprove(true)}>
        Approve
      </Button>
      <Button size="sm" variant="destructive" disabled={pending} onClick={() => setConfirmingDelete(true)}>
        Delete
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
