"use client";
import { useActionState } from "react";
import { signupAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, undefined);
  return (
    <form action={action} className="space-y-4 rounded-lg bg-white p-6 shadow-xl">
      <div className="space-y-1">
        <Label htmlFor="membershipNumber">Membership number</Label>
        <Input id="membershipNumber" name="membershipNumber" required placeholder="MEM-000001" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">Email on file with your Treasurer</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required placeholder="you@example.com" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Choose a password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Activating…" : "Activate account"}
      </Button>
    </form>
  );
}
