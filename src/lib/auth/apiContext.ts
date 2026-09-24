import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/services/apiKeys";
import type { Ctx } from "./context";

/** Synthetic read-only context for requests authenticated by API key rather than a user session. */
export const API_CTX: Ctx = { userId: "api", role: "ADMIN", name: "API integration", email: "api@system.local" };

export async function requireApiKey(req: NextRequest): Promise<NextResponse | null> {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const ok = await verifyApiKey(bearer);
  if (!ok) return NextResponse.json({ error: "Missing or invalid API key." }, { status: 401 });
  return null;
}
