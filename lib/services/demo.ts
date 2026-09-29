import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { autoMap } from "@/lib/fields";
import { demoRows } from "@/lib/demo/data";
import { applyTemplate, createBatch, importCandidates } from "./batches";
import { seedOrgTemplates } from "./templates";

/** One-click demo: 100 fictional candidates, mapped, validated and paired with the SATHII template. */
export async function createDemoBatch(orgId: string, count = 100) {
  const templates = await seedOrgTemplates(orgId);
  const tpl = templates.find((t) => t.config.layout === "panel") ?? templates[0];
  const batch = await createBatch(orgId, {
    name: "[DEMO] SATHII 2026 — fictional candidates",
    examName: "SATHII Scholarship Examination 2026",
    session: "2026–27",
    isDemo: true,
  });
  const rows = demoRows(count);
  const mapping = autoMap(Object.keys(rows[0]));
  await importCandidates(orgId, batch.id, {
    rows,
    mapping,
    policy: "skip",
    resolutions: {},
    fileName: `demo-candidates-${count}.csv`,
    fileSize: JSON.stringify(rows).length,
    mode: "replace",
  });
  await applyTemplate(orgId, batch.id, tpl.id);
  const [b] = await db.select().from(schema.batches).where(and(eq(schema.batches.id, batch.id), eq(schema.batches.orgId, orgId)));
  return b;
}
