import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { landingPath } from "@/lib/auth/permissions";

export default async function RootPage() {
  const ctx = await getSession();
  redirect(ctx ? landingPath(ctx.role) : "/login");
}
