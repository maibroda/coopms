import "server-only";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { requireAction } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import type { Ctx } from "@/lib/auth/context";

/** Wraps a server action: authorization, error → friendly message, revalidation. */
export async function act(
  permission: Permission | undefined,
  fn: (ctx: Ctx) => Promise<Partial<ActionResult> | void>,
  revalidate: string[] = [],
): Promise<ActionResult> {
  try {
    const ctx = await requireAction(permission);
    const r = (await fn(ctx)) ?? {};
    for (const p of revalidate) revalidatePath(p, "layout");
    return { ok: true, message: "Saved.", ...r };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { ok: false, error: "A record with the same unique value already exists." };
    const msg = (e as Error).message ?? "Something went wrong.";
    return { ok: false, error: msg.length > 400 ? msg.slice(0, 400) + "…" : msg };
  }
}
