/** Resolves template and candidate image references into self-contained data URIs. */
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { storage } from "@/lib/storage";
import { fetchRemoteImage, toDataUri } from "@/lib/security/images";
import { classifyImageRef } from "@/lib/csv/validate";
import { fillTokens } from "@/lib/security/sanitize";
import type { TemplateConfig } from "@/lib/template/types";
import { builtinDataUri } from "./builtin";
import { codeSvg } from "./codes";
import { renderCard, type CardContext, type CardImages, type RenderedCard } from "./card";
import type { CustomFieldDef } from "@/lib/fields";

export class ImageResolver {
  private cache = new Map<string, Promise<string | null>>();
  private batchFiles: Promise<Map<string, { key: string; mime: string }>> | null = null;

  constructor(
    private orgId: string,
    private batchId: string | null,
  ) {}

  /** "asset:<id>" | "builtin:<name>" -> data URI (org-scoped). */
  ref(ref: string | null): Promise<string | null> {
    if (!ref) return Promise.resolve(null);
    let p = this.cache.get(ref);
    if (!p) {
      p = this.loadRef(ref);
      this.cache.set(ref, p);
    }
    return p;
  }

  private async loadRef(ref: string): Promise<string | null> {
    if (ref.startsWith("builtin:")) return builtinDataUri(ref.slice(8));
    if (ref.startsWith("asset:")) {
      const id = ref.slice(6);
      const [a] = await db
        .select()
        .from(schema.assets)
        .where(and(eq(schema.assets.id, id), eq(schema.assets.orgId, this.orgId)))
        .limit(1);
      if (!a) return null;
      const buf = await storage().get(a.storageKey);
      return toDataUri(buf, a.mime);
    }
    return null;
  }

  async templateImages(t: TemplateConfig): Promise<CardImages> {
    const b = t.branding;
    const [logo, secondaryLogo, watermark, backgroundImage, signatureImage, stamp] = await Promise.all([
      this.ref(b.logo),
      this.ref(b.secondaryLogo),
      this.ref(b.watermark),
      this.ref(b.backgroundImage),
      this.ref(b.signatureImage),
      this.ref(b.stamp),
    ]);
    return { logo, secondaryLogo, watermark, backgroundImage, signatureImage, stamp };
  }

  private loadBatchFiles() {
    if (!this.batchFiles) {
      this.batchFiles = (async () => {
        const m = new Map<string, { key: string; mime: string }>();
        if (!this.batchId) return m;
        const rows = await db
          .select()
          .from(schema.assets)
          .where(and(eq(schema.assets.orgId, this.orgId), eq(schema.assets.batchId, this.batchId), eq(schema.assets.kind, "photo")));
        for (const r of rows) m.set(r.originalName.toLowerCase(), { key: r.storageKey, mime: r.mime });
        return m;
      })();
    }
    return this.batchFiles;
  }

  /** Candidate photo / signature. Throws a readable error when the reference cannot be resolved. */
  async candidateImage(value: string | undefined, what: string): Promise<string | null> {
    if (!value) return null;
    const kind = classifyImageRef(value);
    const ck = `cand:${value}`;
    const cached = this.cache.get(ck);
    if (cached) return cached;
    const p = (async () => {
      if (kind === "demo") return builtinDataUri(value.replace("demo:", "demo-"));
      if (kind === "url") {
        const { buf, mime } = await fetchRemoteImage(value);
        return toDataUri(buf, mime);
      }
      if (kind === "file") {
        const files = await this.loadBatchFiles();
        const f = files.get(value.toLowerCase());
        if (!f) throw new Error(`${what} file "${value}" has not been uploaded to this batch`);
        return toDataUri(await storage().get(f.key), f.mime);
      }
      throw new Error(`${what} reference is not a valid URL or filename`);
    })();
    // Only cache remote/demo values that repeat; per-candidate files are rarely reused.
    if (kind !== "file") this.cache.set(ck, p);
    return p;
  }
}

/** Render one candidate's card with all images resolved (used for preview and PDF). */
export async function renderCandidateCard(
  t: TemplateConfig,
  data: Record<string, string>,
  resolver: ImageResolver,
  customFields: CustomFieldDef[],
  opts: { tolerateMissingImages?: boolean } = {},
): Promise<RenderedCard> {
  const base = await resolver.templateImages(t);
  const get = async (v: string | undefined, what: string) => {
    try {
      return await resolver.candidateImage(v, what);
    } catch (err) {
      if (opts.tolerateMissingImages) return null;
      throw err;
    }
  };
  const [photo, candidateSignature] = await Promise.all([get(data.photo, "Photo"), get(data.signature, "Signature")]);
  const codeData = t.code.enabled ? fillTokens(t.code.data, data).replace(/^\|+|\|+$/g, "") || data.qr_data || "" : "";
  const ctx: CardContext = {
    images: { ...base, photo, candidateSignature },
    codeSvg: t.code.enabled ? await codeSvg(t.code.kind, data.qr_data || codeData, t.branding.text) : null,
    customFields,
  };
  return renderCard(t, data, ctx);
}
