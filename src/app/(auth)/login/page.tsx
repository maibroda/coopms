import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { landingPath } from "@/lib/auth/permissions";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const ctx = await getSession();
  if (ctx) redirect(landingPath(ctx.role));
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <h1 className="text-2xl font-semibold tracking-tight">Cooperative Management System</h1>
          <p className="mt-1 text-sm text-slate-400">Contributions, loans, purchases & payroll deductions</p>
        </div>
        <LoginForm />
        <p className="mt-4 text-center text-sm text-slate-400">
          <Link href="/forgot-password" className="text-white underline">
            Forgot your password?
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-slate-400">
          A member who hasn&apos;t set a password yet?{" "}
          <Link href="/signup" className="text-white underline">
            Activate your account
          </Link>
        </p>
        <div className="mt-6 rounded-lg border border-slate-700 p-3 text-xs text-slate-400">
          <p className="mb-1 font-medium text-slate-300">Demo accounts (password: Password123!)</p>
          <ul className="grid grid-cols-1 gap-0.5">
            <li>admin@coop.test — Admin</li>
            <li>treasurer@coop.test — Treasurer</li>
            <li>member1@coop.test — Member self-service</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
