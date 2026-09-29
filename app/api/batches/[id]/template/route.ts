import { NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/lib/auth/session";
import { applyTemplate } from "@/lib/services/batches";
import type { IdCtx } from "@/lib/http";

export const POST = api<IdCtx>(async (req, s, ctx) => {
  const { id } = await ctx.params;
  const { templateId } = z.object({ templateId: z.string().uuid() }).parse(await req.json());
  return NextResponse.json(await applyTemplate(s.orgId, id, templateId));
});
