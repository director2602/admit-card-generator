import { NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/lib/auth/session";
import { createBatch, listBatches } from "@/lib/services/batches";

export const GET = api(async (_req, s) => NextResponse.json({ batches: await listBatches(s.orgId) }));

const body = z.object({
  name: z.string().trim().min(1).max(160),
  examName: z.string().trim().max(200).default(""),
  session: z.string().trim().max(100).default(""),
});

export const POST = api(async (req, s) => {
  const input = body.parse(await req.json());
  const b = await createBatch(s.orgId, input);
  return NextResponse.json({ batch: b }, { status: 201 });
});
