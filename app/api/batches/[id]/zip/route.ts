import { Readable } from "node:stream";
import { api } from "@/lib/auth/session";
import { zipStream } from "@/lib/services/outputs";
import { contentDisposition, parseIds, type IdCtx } from "@/lib/http";

async function handle(id: string, orgId: string, ids: string[] | null) {
  const { stream, name } = await zipStream(orgId, id, ids);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    headers: { "content-type": "application/zip", "content-disposition": contentDisposition("attachment", name), "cache-control": "private, no-store" },
  });
}

export const GET = api<IdCtx>(async (req, s, ctx) => {
  const { id } = await ctx.params;
  return handle(id, s.orgId, parseIds(new URL(req.url).searchParams.get("ids")));
});

// POST (form submit) supports large selections that would not fit in a URL.
export const POST = api<IdCtx>(async (req, s, ctx) => {
  const { id } = await ctx.params;
  const form = await req.formData();
  return handle(id, s.orgId, parseIds(String(form.get("ids") ?? "")));
});
