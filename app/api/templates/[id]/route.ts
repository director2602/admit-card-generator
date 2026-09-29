import { NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/lib/auth/session";
import { deleteTemplate, getTemplate, updateTemplate } from "@/lib/services/templates";
import type { IdCtx } from "@/lib/http";

export const GET = api<IdCtx>(async (_req, s, ctx) => {
  const { id } = await ctx.params;
  return NextResponse.json({ template: await getTemplate(s.orgId, id) });
});

export const PATCH = api<IdCtx>(async (req, s, ctx) => {
  const { id } = await ctx.params;
  const p = z.object({ name: z.string().max(120).optional(), config: z.unknown().optional() }).parse(await req.json());
  return NextResponse.json({ template: await updateTemplate(s.orgId, id, p) });
});

export const DELETE = api<IdCtx>(async (_req, s, ctx) => {
  const { id } = await ctx.params;
  await deleteTemplate(s.orgId, id);
  return NextResponse.json({ ok: true });
});
