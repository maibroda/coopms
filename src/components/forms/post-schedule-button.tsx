"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postScheduleAction } from "@/app/actions/schedule";
import { Button } from "@/components/ui/button";

export function PostScheduleButton({ month }: { month: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function confirmPost() {
    setError(null);
    startTransition(async () => {
      const r = await postScheduleAction(month);
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      setConfirming(false);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm">Post {month} to payroll? This cannot be undone.</span>
          <Button onClick={confirmPost} disabled={pending}>
            {pending ? "Posting…" : "Confirm"}
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
            Cancel
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return <Button onClick={() => setConfirming(true)}>Post to payroll</Button>;
}
