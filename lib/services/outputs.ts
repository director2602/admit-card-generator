import { PassThrough, Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { PDFDocument } from "pdf-lib";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Candidate } from "@/lib/db/schema";
import { HttpError } from "@/lib/auth/http-error";
import { keys, storage } from "@/lib/storage";
import { toCsv } from "@/lib/security/sanitize";
import { getBatch } from "./batches";
import type { TemplateConfig } from "@/lib/template/types";
import { cardCss, htmlDocument, paginate, type RenderedCard } from "@/lib/render/card";
import { fontCss } from "@/lib/render/fonts";
import { ImageResolver, renderCandidateCard } from "@/lib/render/resolve";
import { htmlToPdf } from "@/lib/pdf/browser";
import { log } from "@/lib/logger";

export type SortKey = "csv" | "roll" | "name";

function orderFor(sort: SortKey) {
  if (sort === "roll") return [asc(schema.candidates.rollNumber), asc(schema.candidates.rowNumber)];
  if (sort === "name") return [asc(sql`lower(${schema.candidates.name})`), asc(schema.candidates.rowNumber)];
  return [asc(schema.candidates.rowNumber)];
}

async function selectCandidates(batchId: string, ids: string[] | null, sort: SortKey = "csv", onlyValid = true) {
  const conds = [eq(schema.candidates.batchId, batchId)];
  if (onlyValid) conds.push(inArray(schema.candidates.recordStatus, ["valid"]));
  if (ids?.length) conds.push(inArray(schema.candidates.id, ids));
  return db
    .select()
    .from(schema.candidates)
    .where(and(...conds))
    .orderBy(...orderFor(sort));
}

/** Streams a ZIP of generated PDFs plus manifest.csv. */
export async function zipStream(orgId: string, batchId: string, ids: string[] | null): Promise<{ stream: Readable; name: string }> {
  const batch = await getBatch(orgId, batchId);
  // The manifest lists every row (including invalid/duplicate ones with their status).
  const cands = await selectCandidates(batchId, ids, "csv", false);
  const done = cands.filter((c) => c.recordStatus === "valid" && c.genStatus === "done" && c.fileKey);
  if (!done.length) throw new HttpError(400, "No generated admit cards to download yet.");

  const archive = new ZipArchive({ zlib: { level: 6 } });
  const out = new PassThrough();
  archive.on("warning", (e: Error) => log.warn("zip.warning", { batchId, error: String(e) }));
  archive.on("error", (e: Error) => {
    log.error("zip.error", { batchId, error: String(e) });
    out.destroy(e);
  });
  archive.pipe(out);

  void (async () => {
    try {
      const folder = "admit-cards/";
      for (const c of done) {
        const s = await storage().stream(c.fileKey!);
        archive.append(s, { name: folder + c.fileName });
        // Wait for this entry to be consumed before opening the next stream (bounded memory).
        await new Promise<void>((resolve, reject) => {
          const onEntry = () => {
            archive.off("error", onErr);
            resolve();
          };
          const onErr = (e: Error) => reject(e);
          archive.once("entry", onEntry);
          archive.once("error", onErr);
        });
      }
      const manifest = toCsv([
        ["row_number", "roll_number", "application_number", "candidate_name", "file_name", "record_status", "generation_status", "error"],
        ...cands.map((c) => [
          c.rowNumber,
          c.rollNumber,
          c.applicationNumber,
          c.name,
          c.genStatus === "done" ? c.fileName : "",
          c.recordStatus,
          c.genStatus,
          c.genError ?? c.errors.map((e) => e.message).join("; "),
        ]),
      ]);
      archive.append(manifest, { name: "manifest.csv" });
      await archive.finalize();
    } catch (err) {
      archive.abort();
      out.destroy(err as Error);
    }
  })();

  const safeName = (batch.name || "batch").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60);
  return { stream: out, name: `${safeName}_admit_cards.zip` };
}

/** Builds (or reuses a cached) combined, print-ready PDF. */
export async function combinedPdf(
  orgId: string,
  batchId: string,
  opts: { sort: SortKey; ids: string[] | null },
): Promise<{ key: string; name: string }> {
  const batch = await getBatch(orgId, batchId);
  if (!batch.templateSnapshot) throw new HttpError(400, "No template selected for this batch.");
  const template = batch.templateSnapshot as TemplateConfig;
  const cands = (await selectCandidates(batchId, opts.ids, opts.sort)).filter((c) => c.genStatus === "done" && c.fileKey);
  if (!cands.length) throw new HttpError(400, "No generated admit cards to combine yet.");
  const safeName = (batch.name || "batch").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60);
  const name = `${safeName}_combined_${opts.sort}.pdf`;

  const cacheable = !opts.ids?.length;
  if (cacheable && batch.combinedKey && batch.combinedSort === opts.sort && batch.combinedAt) {
    const newest = Math.max(...cands.map((c) => c.generatedAt?.getTime() ?? 0));
    if (newest <= batch.combinedAt.getTime() && (await storage().exists(batch.combinedKey))) return { key: batch.combinedKey, name };
  }

  const merged = await PDFDocument.create();
  merged.setTitle(`${batch.name} — admit cards`);
  merged.setProducer("Bulk Admit Card Generator");

  if (template.page.cardsPerPage === 1) {
    // One card per page: merge the already-rendered individual PDFs (fast, identical output).
    for (const c of cands) {
      const src = await PDFDocument.load(await storage().get(c.fileKey!));
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }
  } else {
    // Multi-up layout: re-render in chunks so memory stays bounded.
    const resolver = new ImageResolver(orgId, batchId);
    const css = cardCss(template);
    const fonts = fontCss(template, "data");
    const perChunk = template.page.cardsPerPage * 10;
    for (let i = 0; i < cands.length; i += perChunk) {
      const cards: RenderedCard[] = [];
      for (const c of cands.slice(i, i + perChunk)) {
        cards.push(await renderCandidateCard(template, c.data, resolver, batch.mapping?.customFields ?? [], { tolerateMissingImages: true }));
      }
      const pdf = await htmlToPdf(htmlDocument({ css, fontCss: fonts, body: paginate(template, cards) }));
      const src = await PDFDocument.load(pdf);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }
  }
  const bytes = Buffer.from(await merged.save());
  const key = keys.combined(orgId, batchId, `${opts.sort}-${Date.now()}`);
  await storage().put(key, bytes, "application/pdf");
  if (cacheable) {
    if (batch.combinedKey) await storage().delete(batch.combinedKey).catch(() => {});
    await db
      .update(schema.batches)
      .set({ combinedKey: key, combinedSort: opts.sort, combinedAt: new Date() })
      .where(eq(schema.batches.id, batchId));
  }
  log.info("combined.built", { batchId, pages: merged.getPageCount() });
  return { key, name };
}

export async function errorReportCsv(orgId: string, batchId: string): Promise<string> {
  await getBatch(orgId, batchId);
  const rows = await db
    .select()
    .from(schema.candidates)
    .where(eq(schema.candidates.batchId, batchId))
    .orderBy(asc(schema.candidates.rowNumber));
  const bad = rows.filter((r: Candidate) => r.recordStatus !== "valid" || r.flagged || r.genStatus === "failed");
  return toCsv([
    ["row_number", "roll_number", "application_number", "candidate_name", "record_status", "field", "error"],
    ...bad.flatMap((r) => {
      const errs = [...r.errors, ...(r.genStatus === "failed" ? [{ field: "pdf", message: r.genError ?? "Generation failed" }] : [])];
      return errs.map((e) => [r.rowNumber, r.rollNumber, r.applicationNumber, r.name, r.recordStatus, e.field, e.message]);
    }),
  ]);
}
