import JSZip from "jszip";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { HttpError } from "@/lib/auth/http-error";
import { env } from "@/lib/env";
import { extFor, sniffImage } from "@/lib/security/images";
import { safeFileSegment } from "@/lib/security/sanitize";
import { keys, storage } from "@/lib/storage";
import { getBatch } from "./batches";

export const BRAND_KINDS = ["logo", "signature", "stamp", "watermark", "background"] as const;
export type BrandKind = (typeof BRAND_KINDS)[number];

async function storeImage(orgId: string, buf: Buffer, originalName: string, kind: string, batchId: string | null) {
  if (buf.length > env.maxImageBytes) throw new HttpError(413, `Image "${originalName}" exceeds ${Math.round(env.maxImageBytes / 1048576)} MB`);
  const mime = sniffImage(buf);
  if (!mime) throw new HttpError(415, `"${originalName}" is not a PNG, JPEG or WebP image`);
  const id = crypto.randomUUID();
  const key = keys.asset(orgId, id, extFor(mime));
  await storage().put(key, buf, mime);
  const [a] = await db
    .insert(schema.assets)
    .values({ id, orgId, batchId, kind, originalName: originalName.slice(0, 200), storageKey: key, mime, size: buf.length })
    .returning();
  return a;
}

export async function uploadBrandAsset(orgId: string, file: File, kind: string) {
  if (!BRAND_KINDS.includes(kind as BrandKind)) throw new HttpError(400, "Unknown asset type");
  const buf = Buffer.from(await file.arrayBuffer());
  return storeImage(orgId, buf, safeFileSegment(file.name), kind, null);
}

/** Upload candidate photos/signatures for a batch: individual images or a ZIP of images. Matched by filename. */
export async function uploadBatchPhotos(orgId: string, batchId: string, files: File[]) {
  await getBatch(orgId, batchId);
  const existing = await db
    .select()
    .from(schema.assets)
    .where(and(eq(schema.assets.orgId, orgId), eq(schema.assets.batchId, batchId), eq(schema.assets.kind, "photo")));
  const byName = new Map(existing.map((a) => [a.originalName.toLowerCase(), a]));
  let stored = 0;
  const rejected: string[] = [];

  const put = async (name: string, buf: Buffer) => {
    const base = name.split(/[\\/]/).pop() ?? name;
    if (!/\.(png|jpe?g|webp)$/i.test(base) || base.startsWith(".")) return;
    try {
      const prev = byName.get(base.toLowerCase());
      const a = await storeImage(orgId, buf, base, "photo", batchId);
      if (prev) {
        await storage().delete(prev.storageKey).catch(() => {});
        await db.delete(schema.assets).where(eq(schema.assets.id, prev.id));
      }
      byName.set(base.toLowerCase(), a);
      stored++;
    } catch (err) {
      rejected.push(`${base}: ${(err as Error).message}`);
    }
  };

  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      if (f.size > env.maxPhotoZipBytes) throw new HttpError(413, "ZIP file is too large");
      const zip = await JSZip.loadAsync(await f.arrayBuffer());
      const entries = Object.values(zip.files).filter((e) => !e.dir);
      if (entries.length > 25000) throw new HttpError(400, "ZIP contains too many files");
      for (const entry of entries) {
        // Entry names are only used as lookup keys (basename) — never as filesystem paths.
        await put(entry.name, await entry.async("nodebuffer"));
      }
    } else {
      await put(f.name, Buffer.from(await f.arrayBuffer()));
    }
  }
  return { stored, rejected: rejected.slice(0, 50), total: byName.size };
}

export async function getAsset(orgId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, "Not found");
  const [a] = await db
    .select()
    .from(schema.assets)
    .where(and(eq(schema.assets.id, id), eq(schema.assets.orgId, orgId)));
  if (!a) throw new HttpError(404, "Not found");
  return a;
}
