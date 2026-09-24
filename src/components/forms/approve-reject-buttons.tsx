"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ApproveRejectButtons({
  onApprove,
  onReject,
}: {
  onApprove: () => Promise<{ ok: boolean; error?: string }>;
  onReject: (reason: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      router.refresh();
    });
  }

  if (rejecting) {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-1">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="h-8 w-40 text-xs" />
          <Button size="sm" variant="destructive" disabled={pending || !reason.trim()} onClick={() => run(() => onReject(reason))}>
            Confirm reject
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
            Cancel
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1">
        <Button size="sm" disabled={pending} onClick={() => run(onApprove)}>
          Approve
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setRejecting(true)}>
          Reject
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
