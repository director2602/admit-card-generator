import { notFound } from "next/navigation";
import { and, asc, count, eq } from "drizzle-orm";
import { requirePageSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { batchStats, emptyStats, getBatch } from "@/lib/services/batches";
import { listTemplates, seedOrgTemplates } from "@/lib/services/templates";
import { PageHeader } from "@/components/app/sidebar";
import { Wizard } from "@/components/wizard/wizard";
import { BatchStatusBadge } from "@/components/app/status";

export const metadata = { title: "Batch setup" };

export default async function SetupPage(props: PageProps<"/batches/[id]/setup">) {
  const s = await requirePageSession();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const batch = await getBatch(s.orgId, id).catch(() => null);
  if (!batch) notFound();
  await seedOrgTemplates(s.orgId);
  const [templates, presets, stats, [photos]] = await Promise.all([
    listTemplates(s.orgId),
    db.select().from(schema.mappingPresets).where(eq(schema.mappingPresets.orgId, s.orgId)).orderBy(asc(schema.mappingPresets.name)),
    batchStats(s.orgId, [id]),
    db
      .select({ n: count() })
      .from(schema.assets)
      .where(and(eq(schema.assets.orgId, s.orgId), eq(schema.assets.batchId, id), eq(schema.assets.kind, "photo"))),
  ]);
  const st = stats[id] ?? emptyStats();
  const requested = Number(Array.isArray(sp.step) ? sp.step[0] : sp.step) || 2;
  return (
    <>
      <PageHeader
        title={batch.name}
        description={[batch.examName, batch.session].filter(Boolean).join(" · ") || "Examination batch"}
        actions={<BatchStatusBadge status={batch.status} />}
      />
      <Wizard
        key={id}
        step={Math.min(Math.max(requested, 2), 7)}
        batch={{
          id: batch.id,
          name: batch.name,
          examName: batch.examName,
          status: batch.status,
          mapping: batch.mapping,
          templateId: batch.templateId,
          hasTemplate: !!batch.templateSnapshot,
          csvFileName: batch.csvFileName,
          isDemo: batch.isDemo,
        }}
        stats={st}
        photoCount={photos?.n ?? 0}
        templates={templates.map((t) => ({ id: t.id, name: t.name, layout: t.config.layout, updatedAt: t.updatedAt.toISOString() }))}
        presets={presets.map((p) => ({ id: p.id, name: p.name, mapping: p.mapping }))}
      />
    </>
  );
}
