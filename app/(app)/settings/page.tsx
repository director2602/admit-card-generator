import { asc, eq } from "drizzle-orm";
import { requirePageSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/app/sidebar";
import { SettingsForm } from "@/components/settings/settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const s = await requirePageSession();
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, s.orgId));
  const presets = await db
    .select({ id: schema.mappingPresets.id, name: schema.mappingPresets.name })
    .from(schema.mappingPresets)
    .where(eq(schema.mappingPresets.orgId, s.orgId))
    .orderBy(asc(schema.mappingPresets.name));
  return (
    <>
      <PageHeader title="Settings" description="Organisation profile, data retention and saved mappings." />
      <SettingsForm
        org={{ name: org.name, retentionDays: org.retentionDays }}
        user={{ name: s.name, email: s.email }}
        presets={presets}
        system={{
          storage: env.storageDriver,
          worker: env.workerMode,
          concurrency: env.pdfConcurrency,
          chromium: !!env.chromiumPath,
          remotePhotos: env.allowRemotePhotos,
          maxImageMb: Math.round(env.maxImageBytes / 1048576),
        }}
      />
    </>
  );
}
