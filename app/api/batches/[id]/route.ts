import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { api } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { batchStats, deleteBatch, emptyStats, getBatch } from "@/lib/services/batches";
import { latestJob } from "@/lib/jobs/engine";
import type { IdCtx } from "@/lib/http";

export const GET = api<IdCtx>(async (_req, s, ctx) => {
  const { id } = await ctx.params;
  const batch = await getBatch(s.orgId, id);
  const stats = (await batchStats(s.orgId, [id]))[id] ?? emptyStats();
  return NextResponse.json({ batch, stats, job: await latestJob(s.orgId, id) });
});

const patch = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  examName: z.string().trim().max(200).optional(),
  session: z.string().trim().max(100).optional(),
});

export const PATCH = api<IdCtx>(async (req, s, ctx) => {
  const { id } = await ctx.params;
  await getBatch(s.orgId, id);
  const p = patch.parse(await req.json());
  const [b] = await db.update(schema.batches).set({ ...p, updatedAt: new Date() }).where(eq(schema.batches.id, id)).returning();
  return NextResponse.json({ batch: b });
});

export const DELETE = api<IdCtx>(async (_req, s, ctx) => {
  const { id } = await ctx.params;
  await deleteBatch(s.orgId, id);
  return NextResponse.json({ ok: true });
});
