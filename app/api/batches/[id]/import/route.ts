import { NextResponse } from "next/server";
import { z } from "zod";
import { api, HttpError } from "@/lib/auth/session";
import { importCandidates } from "@/lib/services/batches";
import { env } from "@/lib/env";
import type { IdCtx } from "@/lib/http";

const source = z.discriminatedUnion("type", [
  z.object({ type: z.literal("column"), column: z.string().max(200) }),
  z.object({ type: z.literal("constant"), value: z.string().max(500) }),
  z.object({ type: z.literal("none") }),
]);

const body = z.object({
  rows: z.array(z.record(z.string().max(200), z.unknown())).min(1),
  mapping: z.object({
    fields: z.record(z.string().regex(/^[a-z0-9_]{1,48}$/), source),
    customFields: z
      .array(z.object({ key: z.string().regex(/^[a-z0-9_]{1,48}$/), label: z.string().max(80), required: z.boolean().optional() }))
      .max(40),
    extraRequired: z.array(z.string().max(48)).max(40).optional(),
  }),
  policy: z.enum(["skip", "flag", "manual"]),
  resolutions: z.record(z.string().max(200), z.number().int()).default({}),
  fileName: z.string().max(255),
  fileSize: z.number().int().nonnegative(),
  mode: z.enum(["replace", "update"]).default("replace"),
});

export const POST = api<IdCtx>(async (req, s, ctx) => {
  const { id } = await ctx.params;
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > env.maxCsvBytes * 4) throw new HttpError(413, "Upload is too large");
  const input = body.parse(await req.json());
  if (input.fileSize > env.maxCsvBytes) throw new HttpError(413, "CSV file is too large");
  const res = await importCandidates(s.orgId, id, input);
  return NextResponse.json(res);
});
