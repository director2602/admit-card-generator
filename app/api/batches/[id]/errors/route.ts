import { api } from "@/lib/auth/session";
import { errorReportCsv } from "@/lib/services/outputs";
import { contentDisposition, type IdCtx } from "@/lib/http";

export const GET = api<IdCtx>(async (_req, s, ctx) => {
  const { id } = await ctx.params;
  const csv = await errorReportCsv(s.orgId, id);
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": contentDisposition("attachment", "error-report.csv"), "cache-control": "private, no-store" },
  });
});
