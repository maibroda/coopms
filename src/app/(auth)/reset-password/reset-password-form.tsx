"use client";
import { useActionState } from "react";
import { resetPasswordAction } from "@/app/actions/passwordReset";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);

  if (state?.success) {
    return (
      <div className="space-y-4 rounded-lg bg-white p-6 shadow-xl">
        <p className="text-sm text-foreground">Your password has been reset. You can now sign in with it.</p>
        <a href="/login" className="block text-center text-sm text-primary underline">
          Go to sign in
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-lg bg-white p-6 shadow-xl">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}
