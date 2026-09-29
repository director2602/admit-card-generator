import { NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/lib/auth/session";
import { enqueueJob } from "@/lib/jobs/engine";
import type { IdCtx } from "@/lib/http";

const body = z.object({
  mode: z.enum(["all", "pending", "failed", "selected"]).default("pending"),
  ids: z.array(z.string().uuid()).max(20000).default([]),
});

export const POST = api<IdCtx>(async (req, s, ctx) => {
  const { id } = await ctx.params;
  const { mode, ids } = body.parse(await req.json().catch(() => ({})));
  const job = await enqueueJob(s.orgId, id, mode, ids);
  return NextResponse.json({ job }, { status: 202 });
});
