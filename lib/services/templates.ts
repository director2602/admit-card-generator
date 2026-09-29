import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { HttpError } from "@/lib/auth/http-error";
import { parseTemplateConfig } from "@/lib/template/schema";
import { defaultTemplate, sathiiTemplate } from "@/lib/template/defaults";
import type { TemplateConfig } from "@/lib/template/types";

export async function listTemplates(orgId: string) {
  return db.select().from(schema.templates).where(eq(schema.templates.orgId, orgId)).orderBy(asc(schema.templates.createdAt));
}

export async function getTemplate(orgId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, "Template not found");
  const [t] = await db
    .select()
    .from(schema.templates)
    .where(and(eq(schema.templates.id, id), eq(schema.templates.orgId, orgId)));
  if (!t) throw new HttpError(404, "Template not found");
  return t;
}

/** Ensure every referenced uploaded asset belongs to the org. */
async function assertAssetsOwned(orgId: string, cfg: TemplateConfig) {
  const b = cfg.branding;
  const refs = [b.logo, b.secondaryLogo, b.watermark, b.backgroundImage, b.signatureImage, b.stamp].filter(
    (r): r is string => !!r && r.startsWith("asset:"),
  );
  for (const r of refs) {
    const [a] = await db
      .select({ id: schema.assets.id })
      .from(schema.assets)
      .where(and(eq(schema.assets.id, r.slice(6)), eq(schema.assets.orgId, orgId)));
    if (!a) throw new HttpError(400, "Template references an image that does not exist");
  }
}

export async function createTemplate(orgId: string, name: string, config?: unknown) {
  const cfg = config ? parseTemplateConfig(config) : defaultTemplate();
  await assertAssetsOwned(orgId, cfg);
  const [t] = await db.insert(schema.templates).values({ orgId, name: name.slice(0, 120) || "Untitled template", config: cfg }).returning();
  return t;
}

export async function updateTemplate(orgId: string, id: string, patch: { name?: string; config?: unknown }) {
  await getTemplate(orgId, id);
  const set: Partial<typeof schema.templates.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name.slice(0, 120) || "Untitled template";
  if (patch.config !== undefined) {
    const cfg = parseTemplateConfig(patch.config);
    await assertAssetsOwned(orgId, cfg);
    set.config = cfg;
  }
  const [t] = await db.update(schema.templates).set(set).where(and(eq(schema.templates.id, id), eq(schema.templates.orgId, orgId))).returning();
  return t;
}

export async function deleteTemplate(orgId: string, id: string) {
  await getTemplate(orgId, id);
  await db.delete(schema.templates).where(and(eq(schema.templates.id, id), eq(schema.templates.orgId, orgId)));
}

export async function seedOrgTemplates(orgId: string) {
  const existing = await listTemplates(orgId);
  if (existing.length) return existing;
  await db.insert(schema.templates).values([
    { orgId, name: "Classic Admit Card (A4)", config: defaultTemplate() },
    { orgId, name: "SATHII Exam Admit Card", config: sathiiTemplate() },
  ]);
  return listTemplates(orgId);
}
