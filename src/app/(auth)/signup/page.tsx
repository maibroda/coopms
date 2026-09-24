import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { landingPath } from "@/lib/auth/permissions";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const ctx = await getSession();
  if (ctx) redirect(landingPath(ctx.role));

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <h1 className="text-2xl font-semibold tracking-tight">Activate your account</h1>
          <p className="mt-1 text-sm text-slate-400">
            Enter your membership number and the email your Treasurer has on file to verify it&apos;s you, then
            set a password.
          </p>
        </div>
        <SignupForm />
        <p className="mt-4 text-center text-sm text-slate-400">
          Already activated?{" "}
          <Link href="/login" className="text-white underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
