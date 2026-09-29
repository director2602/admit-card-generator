import { NextResponse } from "next/server";
import { api } from "@/lib/auth/session";
import { cancelJob } from "@/lib/jobs/engine";
import type { IdCtx } from "@/lib/http";

export const POST = api<IdCtx>(async (_req, s, ctx) => {
  const { id } = await ctx.params;
  await cancelJob(s.orgId, id);
  return NextResponse.json({ ok: true });
});
