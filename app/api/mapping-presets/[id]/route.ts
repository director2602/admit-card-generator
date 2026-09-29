import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { api } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { IdCtx } from "@/lib/http";

export const DELETE = api<IdCtx>(async (_req, s, ctx) => {
  const { id } = await ctx.params;
  await db.delete(schema.mappingPresets).where(and(eq(schema.mappingPresets.id, id), eq(schema.mappingPresets.orgId, s.orgId)));
  return NextResponse.json({ ok: true });
});
