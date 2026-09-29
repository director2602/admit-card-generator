import { NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { api } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { FieldMapping } from "@/lib/fields";

export const GET = api(async (_req, s) => {
  const presets = await db.select().from(schema.mappingPresets).where(eq(schema.mappingPresets.orgId, s.orgId)).orderBy(asc(schema.mappingPresets.name));
  return NextResponse.json({ presets });
});

export const POST = api(async (req, s) => {
  const { name, mapping } = z
    .object({ name: z.string().trim().min(1).max(100), mapping: z.object({ fields: z.record(z.string(), z.any()), customFields: z.array(z.any()).max(40) }) })
    .parse(await req.json());
  const [p] = await db.insert(schema.mappingPresets).values({ orgId: s.orgId, name, mapping: mapping as FieldMapping }).returning();
  return NextResponse.json({ preset: p }, { status: 201 });
});
