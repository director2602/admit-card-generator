import { NextResponse } from "next/server";
import { api, HttpError } from "@/lib/auth/session";
import { uploadBatchPhotos } from "@/lib/services/assets";
import type { IdCtx } from "@/lib/http";

export const POST = api<IdCtx>(async (req, s, ctx) => {
  const { id } = await ctx.params;
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) throw new HttpError(400, "No files uploaded");
  return NextResponse.json(await uploadBatchPhotos(s.orgId, id, files));
});
