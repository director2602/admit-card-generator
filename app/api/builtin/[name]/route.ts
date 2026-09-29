import { builtinDataUri } from "@/lib/render/builtin";

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const uri = /^[a-z0-9-]{1,40}$/.test(name) ? builtinDataUri(name) : null;
  if (!uri) return new Response("Not found", { status: 404 });
  const [, mime, b64] = uri.match(/^data:([^;]+);base64,(.*)$/)!;
  return new Response(new Uint8Array(Buffer.from(b64, "base64")), {
    headers: { "content-type": mime, "cache-control": "private, max-age=3600", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" },
  });
}
