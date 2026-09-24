"use server";
import { redirect } from "next/navigation";
import { authenticate, activateMemberAccount } from "@/lib/services/auth";
import { createSession, destroySession } from "@/lib/auth/session";
import { landingPath, type Role } from "@/lib/auth/permissions";

export async function loginAction(_prev: { error?: string } | undefined, form: FormData) {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  let user;
  try {
    user = await authenticate(email, password);
  } catch (e) {
    return { error: (e as Error).message };
  }
  await createSession({
    userId: user.id,
    role: user.role as Role,
    name: user.name,
    email: user.email,
    memberId: user.memberId,
  });
  redirect(landingPath(user.role as Role));
}

export async function signupAction(_prev: { error?: string } | undefined, form: FormData) {
  const membershipNumber = String(form.get("membershipNumber") ?? "");
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const confirmPassword = String(form.get("confirmPassword") ?? "");
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  let user;
  try {
    user = await activateMemberAccount({ membershipNumber, email, password });
  } catch (e) {
    return { error: (e as Error).message };
  }
  await createSession({
    userId: user.id,
    role: user.role as Role,
    name: user.name,
    email: user.email,
    memberId: user.memberId,
  });
  redirect(landingPath(user.role as Role));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
