import { Readable } from "node:stream";
import { storage } from "@/lib/storage";

export type IdCtx = { params: Promise<{ id: string }> };

export function contentDisposition(kind: "inline" | "attachment", fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function streamStored(key: string, fileName: string, mime: string, inline: boolean): Promise<Response> {
  const s = await storage().stream(key);
  return new Response(Readable.toWeb(s) as unknown as ReadableStream, {
    headers: {
      "content-type": mime,
      "content-disposition": contentDisposition(inline ? "inline" : "attachment", fileName),
      "cache-control": "private, no-store",
    },
  });
}

export function parseIds(v: string | null): string[] | null {
  if (!v) return null;
  const ids = v.split(",").filter((x) => /^[0-9a-f-]{36}$/.test(x));
  return ids.length ? ids.slice(0, 20000) : null;
}
