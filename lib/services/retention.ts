import { and, eq, lt, isNull, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { deleteBatch } from "./batches";
import { log } from "@/lib/logger";
import { storage } from "@/lib/storage";

/** Delete batches (records, PDFs, photos) whose retention period has expired. */
export async function purgeExpired(orgId?: string): Promise<number> {
  const conds = [lt(schema.batches.expiresAt, new Date())];
  if (orgId) conds.push(eq(schema.batches.orgId, orgId));
  const expired = await db.select({ id: schema.batches.id, orgId: schema.batches.orgId }).from(schema.batches).where(and(...conds));
  let n = 0;
  for (const b of expired) {
    const [active] = await db
      .select({ id: schema.jobs.id })
      .from(schema.jobs)
      .where(and(eq(schema.jobs.batchId, b.id), inArray(schema.jobs.status, ["queued", "running"])));
    if (active) continue;
    await deleteBatch(b.orgId, b.id);
    n++;
  }
  // Orphaned photo assets whose batch no longer exists.
  const orphans = await db
    .select({ id: schema.assets.id, key: schema.assets.storageKey })
    .from(schema.assets)
    .leftJoin(schema.batches, eq(schema.batches.id, schema.assets.batchId))
    .where(and(eq(schema.assets.kind, "photo"), isNull(schema.batches.id)));
  for (const o of orphans) {
    await storage().delete(o.key).catch(() => {});
    await db.delete(schema.assets).where(eq(schema.assets.id, o.id));
  }
  if (n || orphans.length) log.info("retention.purged", { batches: n, orphanAssets: orphans.length });
  return n;
}
