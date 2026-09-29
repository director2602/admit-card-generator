import { api } from "@/lib/auth/session";
import { combinedPdf, type SortKey } from "@/lib/services/outputs";
import { parseIds, streamStored, type IdCtx } from "@/lib/http";

export const maxDuration = 300;

async function handle(id: string, orgId: string, sp: URLSearchParams, ids: string[] | null) {
  const sort = (["csv", "roll", "name"].includes(sp.get("sort") ?? "") ? sp.get("sort") : "csv") as SortKey;
  const { key, name } = await combinedPdf(orgId, id, { sort, ids });
  return streamStored(key, name, "application/pdf", sp.get("inline") === "1");
}

export const GET = api<IdCtx>(async (req, s, ctx) => {
  const { id } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  return handle(id, s.orgId, sp, parseIds(sp.get("ids")));
});

export const POST = api<IdCtx>(async (req, s, ctx) => {
  const { id } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const form = await req.formData();
  return handle(id, s.orgId, sp, parseIds(String(form.get("ids") ?? "")));
});
