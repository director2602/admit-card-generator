import { api } from "@/lib/auth/session";
import { getAsset } from "@/lib/services/assets";
import { streamStored, type IdCtx } from "@/lib/http";

export const GET = api<IdCtx>(async (_req, s, ctx) => {
  const { id } = await ctx.params;
  const a = await getAsset(s.orgId, id);
  return streamStored(a.storageKey, a.originalName, a.mime, true);
});
