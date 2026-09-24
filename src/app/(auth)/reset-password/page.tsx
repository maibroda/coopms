import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { landingPath } from "@/lib/auth/permissions";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const ctx = await getSession();
  if (ctx) redirect(landingPath(ctx.role));
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 p-4 text-center text-white">
        <p>Missing reset token. Use the link from your password reset email.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        </div>
        <ResetPasswordForm token={token} />
      </div>
    </main>
  );
}
