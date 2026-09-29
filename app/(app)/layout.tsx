import { eq } from "drizzle-orm";
import { requirePageSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { AppShell } from "@/components/app/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePageSession();
  const [org] = await db.select({ name: schema.organizations.name }).from(schema.organizations).where(eq(schema.organizations.id, s.orgId));
  return (
    <AppShell orgName={org?.name ?? ""} userName={s.name || s.email}>
      {children}
    </AppShell>
  );
}
