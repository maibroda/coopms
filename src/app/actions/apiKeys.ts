"use server";
import { act } from "./_run";
import * as svc from "@/lib/services/apiKeys";

export async function createApiKeyAction(label: string) {
  return act(
    "settings.manage",
    async (ctx) => {
      const { plaintext } = await svc.createApiKey(ctx, label);
      return { message: "API key created. Copy it now — it won't be shown again.", data: { plaintext } };
    },
    ["/settings/api-keys"],
  );
}

export async function revokeApiKeyAction(id: string) {
  return act(
    "settings.manage",
    async (ctx) => {
      await svc.revokeApiKey(ctx, id);
      return { message: "API key revoked." };
    },
    ["/settings/api-keys"],
  );
}
