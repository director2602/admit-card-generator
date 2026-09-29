import { NextResponse } from "next/server";
import { api } from "@/lib/auth/session";
import { purgeExpired } from "@/lib/services/retention";

export const POST = api(async (_req, s) => NextResponse.json({ deleted: await purgeExpired(s.orgId) }));
