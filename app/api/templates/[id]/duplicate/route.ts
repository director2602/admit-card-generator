import { NextResponse } from "next/server";
import { api } from "@/lib/auth/session";
import { createTemplate, getTemplate } from "@/lib/services/templates";
import type { IdCtx } from "@/lib/http";

export const POST = api<IdCtx>(async (_req, s, ctx) => {
  const { id } = await ctx.params;
  const t = await getTemplate(s.orgId, id);
  const copy = await createTemplate(s.orgId, `${t.name} (copy)`, t.config);
  return NextResponse.json({ template: copy }, { status: 201 });
});
