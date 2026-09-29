import fs from "node:fs/promises";
import { fontFilePath } from "@/lib/render/fonts";

export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const p = fontFilePath(file);
  if (!p) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(await fs.readFile(p)), {
    headers: { "content-type": "font/woff2", "cache-control": "public, max-age=31536000, immutable" },
  });
}
