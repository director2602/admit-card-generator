import { NextResponse } from "next/server";
import { api } from "@/lib/auth/session";
import { batchStats, emptyStats, getBatch } from "@/lib/services/batches";
import { latestJob } from "@/lib/jobs/engine";
import type { IdCtx } from "@/lib/http";

export const GET = api<IdCtx>(async (_req, s, ctx) => {
  const { id } = await ctx.params;
  const batch = await getBatch(s.orgId, id);
  const stats = (await batchStats(s.orgId, [id]))[id] ?? emptyStats();
  const job = await latestJob(s.orgId, id);
  let etaSeconds: number | null = null;
  if (job && job.status === "running" && job.completed + job.failed > 0 && job.elapsedMs > 0) {
    const rate = (job.completed + job.failed) / job.elapsedMs;
    etaSeconds = Math.round((job.total - job.completed - job.failed) / rate / 1000);
  }
  return NextResponse.json({ status: batch.status, stats, job, etaSeconds });
});
