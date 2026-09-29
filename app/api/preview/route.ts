import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { api } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { parseTemplateConfig } from "@/lib/template/schema";
import { pageDims } from "@/lib/template/defaults";
import { cardCss, htmlDocument, paginate } from "@/lib/render/card";
import { fontCss } from "@/lib/render/fonts";
import { ImageResolver, renderCandidateCard } from "@/lib/render/resolve";
import { SAMPLE_CANDIDATE } from "@/lib/demo/sample";
import { getBatch } from "@/lib/services/batches";
import { getCandidate } from "@/lib/services/candidates";
import type { TemplateConfig } from "@/lib/template/types";

const body = z.object({
  template: z.unknown().optional(),
  batchId: z.string().uuid().optional(),
  candidateId: z.string().uuid().optional(),
  count: z.number().int().min(1).max(6).default(1),
});

/** Returns a self-contained HTML document rendered with exactly the same code path as the PDFs. */
export const POST = api(async (req, s) => {
  const input = body.parse(await req.json());
  let template: TemplateConfig | null = input.template ? parseTemplateConfig(input.template) : null;
  let dataset: Record<string, string>[] = [SAMPLE_CANDIDATE];
  let customFields: { key: string; label: string }[] = [];
  let batchId: string | null = null;

  if (input.candidateId) {
    const c = await getCandidate(s.orgId, input.candidateId);
    const b = await getBatch(s.orgId, c.batchId);
    batchId = b.id;
    template ??= b.templateSnapshot;
    customFields = b.mapping?.customFields ?? [];
    dataset = [c.data];
  } else if (input.batchId) {
    const b = await getBatch(s.orgId, input.batchId);
    batchId = b.id;
    template ??= b.templateSnapshot;
    customFields = b.mapping?.customFields ?? [];
    const rows = await db
      .select({ data: schema.candidates.data })
      .from(schema.candidates)
      .where(and(eq(schema.candidates.batchId, b.id), eq(schema.candidates.recordStatus, "valid")))
      .orderBy(asc(schema.candidates.rowNumber))
      .limit(input.count);
    if (rows.length) dataset = rows.map((r) => r.data);
  }
  if (!template) return Response.json({ error: "No template selected" }, { status: 400 });

  const resolver = new ImageResolver(s.orgId, batchId);
  const cards = [];
  for (const d of dataset) cards.push(await renderCandidateCard(template, d, resolver, customFields, { tolerateMissingImages: true }));
  const { w, h } = pageDims(template);
  const html = htmlDocument({
    css: cardCss(template) + `body{background:#e9ebf2} .ac-page{margin:0 auto 8mm; box-shadow:0 2px 12px rgba(20,24,60,.12)}`,
    fontCss: fontCss(template, "url"),
    body: paginate(template, cards),
    extraHead: `<meta name="robots" content="noindex">`,
  });
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "x-page-width-mm": String(w),
      "x-page-height-mm": String(h),
      "content-security-policy": "default-src 'none'; img-src data:; font-src 'self'; style-src 'unsafe-inline'",
    },
  });
});
