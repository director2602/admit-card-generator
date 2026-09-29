import { api, HttpError } from "@/lib/auth/session";
import { getCandidate } from "@/lib/services/candidates";
import { streamStored, type IdCtx } from "@/lib/http";

export const GET = api<IdCtx>(async (req, s, ctx) => {
  const { id } = await ctx.params;
  const c = await getCandidate(s.orgId, id);
  if (c.genStatus !== "done" || !c.fileKey || !c.fileName) throw new HttpError(404, "This admit card has not been generated yet");
  return streamStored(c.fileKey, c.fileName, "application/pdf", new URL(req.url).searchParams.get("inline") === "1");
});
