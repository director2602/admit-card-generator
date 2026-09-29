/**
 * Bulk generation engine.
 *
 * - Jobs and per-candidate status live in PostgreSQL, so progress survives restarts
 *   and the worker can run inline (inside the Next.js server) or as a separate
 *   process (`npm run worker`, WORKER_MODE=external).
 * - Candidates are claimed in chunks with FOR UPDATE SKIP LOCKED and rendered with
 *   a bounded Chromium page pool — never all at once in memory.
 * - A partial unique index allows only one active job per batch, preventing duplicate
 *   processing; retries only touch failed/pending records.
 */
import { and, asc, eq, inArray, lt, or, sql, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Candidate, Job } from "@/lib/db/schema";
import { HttpError } from "@/lib/auth/http-error";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { keys, storage } from "@/lib/storage";
import { fillTokens, safeFileSegment } from "@/lib/security/sanitize";
import { singleCardTemplate } from "@/lib/template/defaults";
import type { TemplateConfig } from "@/lib/template/types";
import { cardCss, htmlDocument, paginate } from "@/lib/render/card";
import { fontCss } from "@/lib/render/fonts";
import { ImageResolver, renderCandidateCard } from "@/lib/render/resolve";
import { htmlToPdf } from "@/lib/pdf/browser";
import { getBatch } from "@/lib/services/batches";

export type JobMode = "all" | "pending" | "failed" | "selected";

export function buildFileName(pattern: string, data: Record<string, string>, fallback: string): string {
  const base = safeFileSegment(fillTokens(pattern || "AdmitCard_{{roll_number}}", data), 110);
  return `${base === "file" ? fallback : base}.pdf`;
}

export async function enqueueJob(orgId: string, batchId: string, mode: JobMode, ids: string[] = []): Promise<Job> {
  const batch = await getBatch(orgId, batchId);
  if (!batch.templateSnapshot) throw new HttpError(400, "Choose a template for this batch before generating.");
  const [active] = await db
    .select({ id: schema.jobs.id })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.batchId, batchId), inArray(schema.jobs.status, ["queued", "running"])))
    .limit(1);
  if (active) throw new HttpError(409, "A generation job is already running for this batch.");

  const target = await db
    .select({ id: schema.candidates.id, data: schema.candidates.data, rowNumber: schema.candidates.rowNumber, fileName: schema.candidates.fileName, genStatus: schema.candidates.genStatus })
    .from(schema.candidates)
    .where(
      and(
        eq(schema.candidates.batchId, batchId),
        eq(schema.candidates.recordStatus, "valid"),
        mode === "pending"
          ? inArray(schema.candidates.genStatus, ["pending", "failed"])
          : mode === "failed"
            ? eq(schema.candidates.genStatus, "failed")
            : mode === "selected"
              ? inArray(schema.candidates.id, ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
              : undefined,
      ),
    )
    .orderBy(asc(schema.candidates.rowNumber));
  if (!target.length) throw new HttpError(400, mode === "failed" ? "There are no failed records to retry." : "There are no records to generate.");

  // Deterministic, unique filenames within the batch.
  const others = await db
    .select({ fileName: schema.candidates.fileName, id: schema.candidates.id })
    .from(schema.candidates)
    .where(and(eq(schema.candidates.batchId, batchId), eq(schema.candidates.genStatus, "done")));
  const targetIds = new Set(target.map((t) => t.id));
  const used = new Set(others.filter((o) => !targetIds.has(o.id) && o.fileName).map((o) => o.fileName!.toLowerCase()));
  const pattern = batch.templateSnapshot.filenamePattern;
  const names = new Map<string, string>();
  for (const c of target) {
    let name = buildFileName(pattern, c.data, `AdmitCard_row${c.rowNumber}`);
    if (used.has(name.toLowerCase())) name = name.replace(/\.pdf$/, `_${c.rowNumber}.pdf`);
    used.add(name.toLowerCase());
    names.set(c.id, name);
  }

  let job: Job;
  try {
    job = await db.transaction(async (tx) => {
      const [j] = await tx
        .insert(schema.jobs)
        .values({ orgId, batchId, mode, status: "queued", total: target.length })
        .returning();
      // Store the intended filename in genError-free fields; update in chunks.
      for (let i = 0; i < target.length; i += 500) {
        const slice = target.slice(i, i + 500);
        await tx.execute(sql`
          update candidates as c set gen_status = 'queued', job_id = ${j.id}, gen_error = null,
            file_name = v.file_name
          from (values ${sql.join(
            slice.map((c) => sql`(${c.id}::uuid, ${names.get(c.id)!})`),
            sql`, `,
          )}) as v(id, file_name)
          where c.id = v.id`);
      }
      await tx
        .update(schema.batches)
        .set({ status: "generating", combinedKey: null, combinedAt: null, updatedAt: new Date() })
        .where(eq(schema.batches.id, batchId));
      return j;
    });
  } catch (err) {
    const code = (err as { code?: string; cause?: { code?: string } }).code ?? (err as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") throw new HttpError(409, "A generation job is already running for this batch.");
    throw err;
  }
  log.info("job.enqueued", { jobId: job.id, batchId, mode, total: target.length });
  kickWorker();
  return job;
}

export async function cancelJob(orgId: string, jobId: string) {
  const r = await db
    .update(schema.jobs)
    .set({ cancelRequested: true })
    .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.orgId, orgId), inArray(schema.jobs.status, ["queued", "running"])))
    .returning({ id: schema.jobs.id });
  if (!r.length) throw new HttpError(404, "No active job to cancel");
  kickWorker();
}

// ---------------------------------------------------------------- worker

interface WorkerState {
  running: boolean;
  timer: NodeJS.Timeout | null;
  kicked: boolean;
  recovered: boolean;
}
const g = globalThis as unknown as { __acgWorker?: WorkerState };
const ws: WorkerState = (g.__acgWorker ??= { running: false, timer: null, kicked: false, recovered: false });

export function kickWorker() {
  if (env.workerMode === "external" && !process.env.ACG_IS_WORKER) return;
  ws.kicked = true;
  if (!ws.running) void loop();
}

export function startWorker() {
  if (ws.timer) return;
  ws.timer = setInterval(() => kickWorker(), 5000);
  ws.timer.unref?.();
  kickWorker();
}

async function recoverStale() {
  // Jobs whose heartbeat stopped (process crash / restart) are resumed from where they left off.
  const cutoff = new Date(Date.now() - (ws.recovered ? 120_000 : 0));
  const stale = await db
    .select()
    .from(schema.jobs)
    .where(and(eq(schema.jobs.status, "running"), or(isNull(schema.jobs.heartbeatAt), lt(schema.jobs.heartbeatAt, cutoff))));
  for (const j of stale) {
    await db
      .update(schema.candidates)
      .set({ genStatus: "queued" })
      .where(and(eq(schema.candidates.jobId, j.id), eq(schema.candidates.genStatus, "processing")));
    await db.update(schema.jobs).set({ status: "queued" }).where(eq(schema.jobs.id, j.id));
    log.warn("job.recovered", { jobId: j.id });
  }
  ws.recovered = true;
}

async function loop() {
  ws.running = true;
  try {
    while (ws.kicked) {
      ws.kicked = false;
      await recoverStale();
      for (;;) {
        const [next] = await db
          .select()
          .from(schema.jobs)
          .where(eq(schema.jobs.status, "queued"))
          .orderBy(asc(schema.jobs.createdAt))
          .limit(1);
        if (!next) break;
        // Claim atomically so two workers never run the same job.
        const claimed = await db
          .update(schema.jobs)
          .set({ status: "running", startedAt: next.startedAt ?? new Date(), heartbeatAt: new Date() })
          .where(and(eq(schema.jobs.id, next.id), eq(schema.jobs.status, "queued")))
          .returning();
        if (!claimed.length) continue;
        await runJob(claimed[0]);
      }
    }
  } catch (err) {
    log.error("worker.loop_error", { error: String(err) });
  } finally {
    ws.running = false;
  }
}

async function refreshCounts(jobId: string, elapsedMs: number) {
  const [c] = await db
    .select({
      done: sql<number>`count(*) filter (where ${schema.candidates.genStatus} = 'done')::int`,
      failed: sql<number>`count(*) filter (where ${schema.candidates.genStatus} = 'failed')::int`,
    })
    .from(schema.candidates)
    .where(eq(schema.candidates.jobId, jobId));
  const [j] = await db
    .update(schema.jobs)
    .set({ completed: c.done, failed: c.failed, heartbeatAt: new Date(), elapsedMs })
    .where(eq(schema.jobs.id, jobId))
    .returning();
  return j;
}

async function runJob(job: Job) {
  const started = Date.now() - job.elapsedMs;
  log.info("job.started", { jobId: job.id, batchId: job.batchId, total: job.total });
  const [batch] = await db.select().from(schema.batches).where(eq(schema.batches.id, job.batchId));
  if (!batch || !batch.templateSnapshot) {
    await db.update(schema.jobs).set({ status: "failed", error: "Batch or template missing", finishedAt: new Date() }).where(eq(schema.jobs.id, job.id));
    return;
  }
  const template = singleCardTemplate(batch.templateSnapshot as TemplateConfig);
  const css = cardCss(template);
  const fonts = fontCss(template, "data");
  const resolver = new ImageResolver(job.orgId, job.batchId);
  const customFields = batch.mapping?.customFields ?? [];

  try {
    for (;;) {
      const [cur] = await db.select({ cancel: schema.jobs.cancelRequested }).from(schema.jobs).where(eq(schema.jobs.id, job.id));
      if (!cur || cur.cancel) {
        await db
          .update(schema.candidates)
          .set({ genStatus: "pending", jobId: null })
          .where(and(eq(schema.candidates.jobId, job.id), inArray(schema.candidates.genStatus, ["queued", "processing"])));
        const j = await refreshCounts(job.id, Date.now() - started);
        await db.update(schema.jobs).set({ status: "cancelled", finishedAt: new Date() }).where(eq(schema.jobs.id, job.id));
        await finalizeBatch(job.batchId, "cancelled");
        log.info("job.cancelled", { jobId: job.id, completed: j?.completed ?? 0 });
        return;
      }
      const chunk = (await db.execute(sql`
        update candidates set gen_status = 'processing'
        where id in (
          select id from candidates where job_id = ${job.id} and gen_status = 'queued'
          order by row_number limit ${env.jobChunkSize} for update skip locked
        ) returning id`)) as unknown as { rows: { id: string }[] };
      const ids = chunk.rows.map((r) => r.id);
      if (!ids.length) break;
      const cands = await db.select().from(schema.candidates).where(inArray(schema.candidates.id, ids));
      await Promise.all(cands.map((c) => renderOne(c, template, css, fonts, resolver, customFields)));
      await refreshCounts(job.id, Date.now() - started);
    }
    const j = await refreshCounts(job.id, Date.now() - started);
    await db.update(schema.jobs).set({ status: "completed", finishedAt: new Date() }).where(eq(schema.jobs.id, job.id));
    await finalizeBatch(job.batchId, j.failed > 0 ? "completed_with_errors" : "completed");
    log.info("job.completed", { jobId: job.id, completed: j.completed, failed: j.failed, ms: Date.now() - started });
  } catch (err) {
    log.error("job.failed", { jobId: job.id, error: String(err) });
    await db
      .update(schema.candidates)
      .set({ genStatus: "queued" })
      .where(and(eq(schema.candidates.jobId, job.id), eq(schema.candidates.genStatus, "processing")));
    await db
      .update(schema.jobs)
      .set({ status: "failed", error: "Generation stopped unexpectedly. Use Retry to resume.", finishedAt: new Date() })
      .where(eq(schema.jobs.id, job.id));
    await db
      .update(schema.candidates)
      .set({ genStatus: "pending", jobId: null })
      .where(and(eq(schema.candidates.jobId, job.id), eq(schema.candidates.genStatus, "queued")));
    await finalizeBatch(job.batchId, "completed_with_errors");
  }
}

async function finalizeBatch(batchId: string, status: "completed" | "completed_with_errors" | "cancelled") {
  const [agg] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${schema.candidates.genStatus} <> 'done' and ${schema.candidates.recordStatus} = 'valid')::int`,
      done: sql<number>`count(*) filter (where ${schema.candidates.genStatus} = 'done')::int`,
    })
    .from(schema.candidates)
    .where(eq(schema.candidates.batchId, batchId));
  const final = status === "cancelled" ? "cancelled" : agg.pending > 0 ? "completed_with_errors" : "completed";
  await db.update(schema.batches).set({ status: final, updatedAt: new Date() }).where(eq(schema.batches.id, batchId));
}

function publicError(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  // Keep messages short and free of filesystem paths.
  return m.replace(/\/[\w./-]+/g, "[path]").slice(0, 300);
}

async function renderOne(
  c: Candidate,
  template: TemplateConfig,
  css: string,
  fonts: string,
  resolver: ImageResolver,
  customFields: { key: string; label: string }[],
) {
  try {
    const card = await renderCandidateCard(template, c.data, resolver, customFields);
    const html = htmlDocument({ css, fontCss: fonts, body: paginate(template, [card], 1), title: c.fileName ?? "Admit Card" });
    const pdf = await htmlToPdf(html);
    const fileName = c.fileName ?? `AdmitCard_row${c.rowNumber}.pdf`;
    const key = keys.pdf(c.orgId, c.batchId, fileName);
    await storage().put(key, pdf, "application/pdf");
    if (c.fileKey && c.fileKey !== key) await storage().delete(c.fileKey).catch(() => {});
    await db
      .update(schema.candidates)
      .set({ genStatus: "done", fileKey: key, fileSize: pdf.length, generatedAt: new Date(), genError: null, attempts: c.attempts + 1 })
      .where(eq(schema.candidates.id, c.id));
  } catch (err) {
    await db
      .update(schema.candidates)
      .set({ genStatus: "failed", genError: publicError(err), attempts: c.attempts + 1 })
      .where(eq(schema.candidates.id, c.id));
    log.warn("candidate.failed", { candidateId: c.id, batchId: c.batchId });
  }
}

export async function latestJob(orgId: string, batchId: string): Promise<Job | null> {
  const [j] = await db
    .select()
    .from(schema.jobs)
    .where(and(eq(schema.jobs.orgId, orgId), eq(schema.jobs.batchId, batchId)))
    .orderBy(sql`${schema.jobs.createdAt} desc`)
    .limit(1);
  return j ?? null;
}
