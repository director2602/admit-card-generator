import { NextResponse } from "next/server";
import { api, HttpError } from "@/lib/auth/session";
import { uploadBrandAsset } from "@/lib/services/assets";

export const POST = api(async (req, s) => {
  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "logo");
  if (!(file instanceof File)) throw new HttpError(400, "No file uploaded");
  const a = await uploadBrandAsset(s.orgId, file, kind);
  return NextResponse.json({ id: a.id, ref: `asset:${a.id}`, name: a.originalName, size: a.size });
});
