"use server";
import { headers } from "next/headers";
import { requestPasswordReset, resetPassword } from "@/lib/services/passwordReset";

async function currentBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3100";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function requestPasswordResetAction(_prev: { message?: string; error?: string; devLink?: string } | undefined, form: FormData) {
  const email = String(form.get("email") ?? "");
  try {
    const { devLink } = await requestPasswordReset(email, await currentBaseUrl());
    return {
      message: "If that email has an account, a reset link has been generated.",
      devLink, // present only because no real email sending is configured yet — see passwordReset.ts
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function resetPasswordAction(_prev: { error?: string; success?: boolean } | undefined, form: FormData) {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirmPassword = String(form.get("confirmPassword") ?? "");
  if (password !== confirmPassword) return { error: "Passwords do not match." };
  try {
    await resetPassword(token, password);
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
