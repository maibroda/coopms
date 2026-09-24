"use client";
import { useActionState } from "react";
import { requestPasswordResetAction } from "@/app/actions/passwordReset";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, undefined);

  if (state?.message) {
    return (
      <div className="space-y-4 rounded-lg bg-white p-6 shadow-xl">
        <p className="text-sm text-foreground">{state.message}</p>
        {state.devLink && (
          <div className="rounded-md bg-muted p-3 text-xs">
            <p className="mb-1 font-medium text-muted-foreground">
              No email sending is configured yet — here&apos;s the link directly (dev/admin use only):
            </p>
            <a href={state.devLink} className="break-all text-primary underline">
              {state.devLink}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-lg bg-white p-6 shadow-xl">
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required placeholder="you@example.com" />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
