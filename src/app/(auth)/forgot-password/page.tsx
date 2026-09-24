import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { landingPath } from "@/lib/auth/permissions";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const ctx = await getSession();
  if (ctx) redirect(landingPath(ctx.role));

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-400">Enter your email and we&apos;ll send you a reset link.</p>
        </div>
        <ForgotPasswordForm />
        <p className="mt-4 text-center text-sm text-slate-400">
          <Link href="/login" className="text-white underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
