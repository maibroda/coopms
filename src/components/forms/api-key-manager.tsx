"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createApiKeyAction, revokeApiKeyAction } from "@/app/actions/apiKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export function ApiKeyCreateForm() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await createApiKeyAction(label);
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      setCreated((r.data as { plaintext: string }).plaintext);
      setLabel("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground/80">Integration label</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. SAP Payroll Sync" className="w-64" />
        </div>
        <Button onClick={submit} disabled={pending || !label.trim()}>
          {pending ? "Creating…" : "Generate key"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {created && (
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-sm font-medium">Copy this key now — it won&apos;t be shown again:</p>
            <code className="block break-all rounded bg-muted px-3 py-2 text-sm">{created}</code>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function RevokeKeyButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await revokeApiKeyAction(id);
              router.refresh();
            })
          }
        >
          {pending ? "Revoking…" : "Confirm"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </span>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
      Revoke
    </Button>
  );
}
