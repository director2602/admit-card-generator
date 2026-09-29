import { NextResponse } from "next/server";
import { api } from "@/lib/auth/session";
import { getCandidate } from "@/lib/services/candidates";
import { getBatch } from "@/lib/services/batches";
import type { IdCtx } from "@/lib/http";

export const GET = api<IdCtx>(async (_req, s, ctx) => {
  const { id } = await ctx.params;
  const c = await getCandidate(s.orgId, id);
  const b = await getBatch(s.orgId, c.batchId);
  return NextResponse.json({ candidate: c, batch: { id: b.id, name: b.name, mapping: b.mapping } });
});
