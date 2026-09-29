import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { api } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

export const GET = api(async (_req, s) => {
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, s.orgId));
  return NextResponse.json({ org, user: { name: s.name, email: s.email } });
});

export const PATCH = api(async (req, s) => {
  const p = z.object({ name: z.string().trim().min(2).max(160).optional(), retentionDays: z.number().int().min(1).max(3650).optional() }).parse(await req.json());
  const [org] = await db.update(schema.organizations).set(p).where(eq(schema.organizations.id, s.orgId)).returning();
  if (p.retentionDays) {
    // Re-compute expiry for existing batches from their creation date.
    await db
      .update(schema.batches)
      .set({ expiresAt: sql`${schema.batches.createdAt} + make_interval(days => ${p.retentionDays})` })
      .where(eq(schema.batches.orgId, s.orgId));
  }
  return NextResponse.json({ org });
});
