import { NextResponse } from "next/server";
import { api } from "@/lib/auth/session";
import { queryCandidates } from "@/lib/services/candidates";

export const GET = api(async (req, s) => {
  const sp = new URL(req.url).searchParams;
  const res = await queryCandidates(s.orgId, {
    batchId: sp.get("batchId") ?? undefined,
    status: sp.get("status") ?? undefined,
    exam: sp.get("exam") ?? undefined,
    q: sp.get("q") ?? undefined,
    sort: (sp.get("sort") as "row") ?? undefined,
    dir: sp.get("dir") === "desc" ? "desc" : "asc",
    page: Number(sp.get("page") ?? 1),
    pageSize: Number(sp.get("pageSize") ?? 25),
  });
  return NextResponse.json(res);
});
