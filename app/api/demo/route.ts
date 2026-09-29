import { NextResponse } from "next/server";
import { api } from "@/lib/auth/session";
import { createDemoBatch } from "@/lib/services/demo";

export const POST = api(async (_req, s) => {
  const batch = await createDemoBatch(s.orgId, 100);
  return NextResponse.json({ batch }, { status: 201 });
});
