import crypto from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Batch } from "@/lib/db/schema";
import { HttpError } from "@/lib/auth/http-error";
import { env } from "@/lib/env";
import { validateRows, type DuplicatePolicy } from "@/lib/csv/validate";
import type { FieldMapping } from "@/lib/fields";
import type { TemplateConfig } from "@/lib/template/types";
import { keys, storage } from "@/lib/storage";
import { log } from "@/lib/logger";

export async function getBatch(orgId: string, batchId: string): Promise<Batch> {
  if (!/^[0-9a-f-]{36}$/.test(batchId)) throw new HttpError(404, "Batch not found");
  const [b] = await db
    .select()
    .from(schema.batches)
    .where(and(eq(schema.batches.id, batchId), eq(schema.batches.orgId, orgId)))
    .limit(1);
  if (!b) throw new HttpError(404, "Batch not found");
  return b;
}

export async function createBatch(
  orgId: string,
  input: { name: string; examName: string; session: string; isDemo?: boolean },
): Promise<Batch> {
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
  const days = org?.retentionDays ?? env.defaultRetentionDays;
  const [b] = await db
    .insert(schema.batches)
    .values({
      orgId,
      name: input.name,
      examName: input.examName,
      session: input.session,
      isDemo: input.isDemo ?? false,
      expiresAt: new Date(Date.now() + days * 86400_000),
    })
    .returning();
  return b;
}

export type { BatchStats } from "./batch-stats-type";
import type { BatchStats } from "./batch-stats-type";

export async function batchStats(orgId: string, batchIds?: string[]): Promise<Record<string, BatchStats>> {
  const rows = await db
    .select({
      batchId: schema.candidates.batchId,
      total: sql<number>`count(*)::int`,
      valid: sql<number>`count(*) filter (where ${schema.candidates.recordStatus} = 'valid')::int`,
      invalid: sql<number>`count(*) filter (where ${schema.candidates.recordStatus} = 'invalid')::int`,
      duplicate: sql<number>`count(*) filter (where ${schema.candidates.recordStatus} = 'duplicate')::int`,
      flagged: sql<number>`count(*) filter (where ${schema.candidates.flagged})::int`,
      generated: sql<number>`count(*) filter (where ${schema.candidates.genStatus} = 'done' and ${schema.candidates.recordStatus} = 'valid')::int`,
      failed: sql<number>`count(*) filter (where ${schema.candidates.genStatus} = 'failed' and ${schema.candidates.recordStatus} = 'valid')::int`,
      pending: sql<number>`count(*) filter (where ${schema.candidates.genStatus} = 'pending' and ${schema.candidates.recordStatus} = 'valid')::int`,
      inProgress: sql<number>`count(*) filter (where ${schema.candidates.genStatus} in ('queued','processing'))::int`,
    })
    .from(schema.candidates)
    .where(
      batchIds?.length
        ? and(eq(schema.candidates.orgId, orgId), inArray(schema.candidates.batchId, batchIds))
        : eq(schema.candidates.orgId, orgId),
    )
    .groupBy(schema.candidates.batchId);
  const out: Record<string, BatchStats> = {};
  for (const r of rows) {
    const { batchId, ...s } = r;
    out[batchId] = s;
  }
  return out;
}

export const emptyStats = (): BatchStats => ({
  total: 0, valid: 0, invalid: 0, duplicate: 0, flagged: 0, generated: 0, failed: 0, pending: 0, inProgress: 0,
});

export async function listBatches(orgId: string) {
  const bs = await db.select().from(schema.batches).where(eq(schema.batches.orgId, orgId)).orderBy(desc(schema.batches.createdAt));
  const stats = await batchStats(orgId);
  return bs.map((b) => ({ ...b, stats: stats[b.id] ?? emptyStats() }));
}

function hashData(d: Record<string, string>): string {
  const sorted = Object.keys(d)
    .sort()
    .map((k) => [k, d[k]]);
  return crypto.createHash("sha256").update(JSON.stringify(sorted)).digest("hex").slice(0, 32);
}

async function assertNoActiveJob(batchId: string) {
  const [active] = await db
    .select({ id: schema.jobs.id })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.batchId, batchId), inArray(schema.jobs.status, ["queued", "running"])))
    .limit(1);
  if (active) throw new HttpError(409, "A generation job is running for this batch. Wait for it to finish or cancel it first.");
}

export interface ImportInput {
  rows: Record<string, unknown>[];
  mapping: FieldMapping;
  policy: DuplicatePolicy;
  resolutions: Record<string, number>;
  fileName: string;
  fileSize: number;
  /** replace = discard previous records; update = merge a corrected CSV, regenerating only changed rows. */
  mode: "replace" | "update";
}

export async function importCandidates(orgId: string, batchId: string, input: ImportInput) {
  const batch = await getBatch(orgId, batchId);
  await assertNoActiveJob(batchId);
  if (input.rows.length > env.maxCsvRows) throw new HttpError(400, `Too many rows (max ${env.maxCsvRows}).`);
  if (input.policy === "manual") {
    // Unresolved groups are simply skipped as duplicates by the validator.
  }
  const { records, summary } = validateRows(input.rows, input.mapping, input.policy, input.resolutions);

  const toRow = (r: (typeof records)[number]) => ({
    orgId,
    batchId,
    rowNumber: r.rowNumber,
    name: r.data.candidate_name ?? "",
    rollNumber: r.data.roll_number ?? "",
    applicationNumber: r.data.application_number ?? "",
    examName: r.data.exam_name || batch.examName,
    data: r.data,
    dataHash: hashData(r.data),
    recordStatus: r.status,
    flagged: r.flagged,
    errors: r.errors,
  });

  let changed = 0;
  let unchanged = 0;
  await db.transaction(async (tx) => {
    if (input.mode === "replace") {
      await tx.delete(schema.candidates).where(eq(schema.candidates.batchId, batchId));
      for (let i = 0; i < records.length; i += 500) {
        await tx.insert(schema.candidates).values(records.slice(i, i + 500).map(toRow));
      }
      changed = records.length;
    } else {
      const existing = await tx
        .select({ id: schema.candidates.id, roll: schema.candidates.rollNumber, hash: schema.candidates.dataHash, genStatus: schema.candidates.genStatus })
        .from(schema.candidates)
        .where(eq(schema.candidates.batchId, batchId));
      const byRoll = new Map(existing.filter((e) => e.roll).map((e) => [e.roll.toUpperCase(), e]));
      const inserts: ReturnType<typeof toRow>[] = [];
      for (const r of records) {
        const row = toRow(r);
        const prev = row.rollNumber ? byRoll.get(row.rollNumber.toUpperCase()) : undefined;
        if (!prev) {
          inserts.push(row);
          changed++;
          continue;
        }
        if (prev.hash === row.dataHash && r.status === "valid") {
          unchanged++;
          await tx.update(schema.candidates).set({ rowNumber: row.rowNumber }).where(eq(schema.candidates.id, prev.id));
          continue;
        }
        changed++;
        await tx
          .update(schema.candidates)
          .set({ ...row, genStatus: "pending", genError: null })
          .where(eq(schema.candidates.id, prev.id));
      }
      for (let i = 0; i < inserts.length; i += 500) await tx.insert(schema.candidates).values(inserts.slice(i, i + 500));
    }
    await tx
      .update(schema.batches)
      .set({
        mapping: input.mapping,
        csvFileName: input.fileName.slice(0, 200),
        csvSize: input.fileSize,
        duplicatePolicy: input.policy,
        status: "imported",
        combinedKey: null,
        combinedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.batches.id, batchId));
  });
  if (input.mode === "replace") {
    await storage().deletePrefix(`${keys.batchPrefix(orgId, batchId)}/pdf`).catch(() => {});
  }
  log.info("batch.import", { batchId, total: summary.total, valid: summary.valid, invalid: summary.invalid, changed, unchanged, mode: input.mode });
  return { summary, changed, unchanged };
}

/** Snapshot the chosen template into the batch. Marks already-generated cards stale if the design changed. */
export async function applyTemplate(orgId: string, batchId: string, templateId: string) {
  const batch = await getBatch(orgId, batchId);
  const [t] = await db
    .select()
    .from(schema.templates)
    .where(and(eq(schema.templates.id, templateId), eq(schema.templates.orgId, orgId)));
  if (!t) throw new HttpError(404, "Template not found");
  await assertNoActiveJob(batchId);
  const changed = JSON.stringify(batch.templateSnapshot) !== JSON.stringify(t.config);
  await db
    .update(schema.batches)
    .set({ templateId, templateSnapshot: t.config as TemplateConfig, updatedAt: new Date(), ...(changed ? { combinedKey: null, combinedAt: null } : {}) })
    .where(eq(schema.batches.id, batchId));
  if (changed) {
    await db
      .update(schema.candidates)
      .set({ genStatus: "pending" })
      .where(and(eq(schema.candidates.batchId, batchId), eq(schema.candidates.genStatus, "done")));
  }
  return { changed };
}

export async function deleteBatch(orgId: string, batchId: string) {
  await getBatch(orgId, batchId);
  await db.update(schema.jobs).set({ cancelRequested: true }).where(eq(schema.jobs.batchId, batchId));
  const photoAssets = await db
    .select({ key: schema.assets.storageKey })
    .from(schema.assets)
    .where(and(eq(schema.assets.orgId, orgId), eq(schema.assets.batchId, batchId)));
  for (const a of photoAssets) await storage().delete(a.key).catch(() => {});
  await db.delete(schema.assets).where(and(eq(schema.assets.orgId, orgId), eq(schema.assets.batchId, batchId)));
  await db.delete(schema.batches).where(and(eq(schema.batches.id, batchId), eq(schema.batches.orgId, orgId)));
  await storage().deletePrefix(keys.batchPrefix(orgId, batchId)).catch(() => {});
  log.info("batch.deleted", { batchId });
}
