"use client";
import { useState } from "react";
import { Label } from "@/components/ui/input";

/**
 * Shown only when the entered amount exceeds the standard eligibility cap. Checking the box
 * reveals a required reason; submitting with it set requests an exception instead of being
 * hard-declined, but always lands PENDING for Admin-only review — never a silent bypass.
 */
export function ExceptionField({ exceeds }: { exceeds: boolean }) {
  const [requesting, setRequesting] = useState(false);

  if (!exceeds) return null;

  return (
    <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
      <p className="text-sm text-destructive">This amount exceeds the standard eligibility cap and will be declined.</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={requesting} onChange={(e) => setRequesting(e.target.checked)} className="h-4 w-4" />
        Request an exception (requires Admin approval)
      </label>
      {requesting && (
        <div className="space-y-1">
          <Label htmlFor="exceptionReason">Reason for the exception</Label>
          <textarea
            id="exceptionReason"
            name="exceptionReason"
            required
            rows={2}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            placeholder="Why this member should be allowed to exceed the standard cap…"
          />
        </div>
      )}
    </div>
  );
}
