import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { Users, CheckCircle2, AlertTriangle, FileCheck2, Activity, FilePlus2, ArrowRight, Upload, Palette, Download } from "lucide-react";
import { requirePageSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { batchStats, emptyStats } from "@/lib/services/batches";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/sidebar";
import { BatchStatusBadge } from "@/components/app/status";
import { DemoButton } from "@/components/app/demo-button";
import { ActiveJobs } from "@/components/app/active-jobs";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const s = await requirePageSession();
  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      valid: sql<number>`count(*) filter (where ${schema.candidates.recordStatus} = 'valid')::int`,
      invalid: sql<number>`count(*) filter (where ${schema.candidates.recordStatus} <> 'valid')::int`,
      generated: sql<number>`count(*) filter (where ${schema.candidates.genStatus} = 'done')::int`,
    })
    .from(schema.candidates)
    .where(eq(schema.candidates.orgId, s.orgId));
  const recent = await db.select().from(schema.batches).where(eq(schema.batches.orgId, s.orgId)).orderBy(desc(schema.batches.updatedAt)).limit(6);
  const stats = recent.length ? await batchStats(s.orgId, recent.map((b) => b.id)) : {};
  const running = await db
    .select({ id: schema.jobs.batchId })
    .from(schema.jobs)
    .where(sql`${schema.jobs.orgId} = ${s.orgId} and ${inArray(schema.jobs.status, ["queued", "running"])}`);
  const current = recent[0];

  const tiles = [
    { label: "Candidates uploaded", value: totals.total, icon: Users, tone: "text-brand bg-brand-soft" },
    { label: "Valid records", value: totals.valid, icon: CheckCircle2, tone: "text-success bg-success-soft" },
    { label: "Invalid / skipped", value: totals.invalid, icon: AlertTriangle, tone: "text-warning bg-warning-soft" },
    { label: "Admit cards generated", value: totals.generated, icon: FileCheck2, tone: "text-primary bg-muted" },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your examination batches and admit card generation."
        actions={
          <>
            <DemoButton />
            <Button asChild>
              <Link href="/create">
                <FilePlus2 /> New admit card batch
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex size-11 items-center justify-center rounded-lg ${t.tone}`}>
                <t.icon className="size-5" aria-hidden />
              </div>
              <div>
                <div className="tabular text-2xl font-extrabold">{t.value.toLocaleString()}</div>
                <div className="text-xs font-medium text-muted-foreground">{t.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
        <Card className="col-span-2 xl:col-span-1">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-lg bg-muted text-foreground">
              <Activity className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="mb-1">{current ? <BatchStatusBadge status={current.status} /> : <span className="text-sm font-bold">No batches yet</span>}</div>
              <div className="truncate text-xs font-medium text-muted-foreground">{current ? `Current batch: ${current.name}` : "Current batch status"}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {running.length > 0 && <ActiveJobs batchIds={running.map((r) => r.id)} />}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px] [&>*]:min-w-0">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent batches</CardTitle>
              <CardDescription>Each examination is kept in its own batch.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/batches">
                View all <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <div className="rounded-md border border-dashed border-input px-4 py-10 text-center text-sm text-muted-foreground">
                No batches yet. Create one or load the demo to see the full workflow.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Batch</th>
                      <th className="py-2 pr-3 font-semibold">Status</th>
                      <th className="py-2 pr-3 text-right font-semibold">Valid</th>
                      <th className="py-2 text-right font-semibold">Generated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((b) => {
                      const st = stats[b.id] ?? emptyStats();
                      return (
                        <tr key={b.id} className="border-b border-border last:border-0">
                          <td className="py-3 pr-3">
                            <Link href={`/batches/${b.id}`} className="font-semibold hover:text-brand hover:underline">
                              {b.name}
                            </Link>
                            <div className="text-xs text-muted-foreground">{b.examName || "—"}</div>
                          </td>
                          <td className="py-3 pr-3">
                            <BatchStatusBadge status={b.status} />
                          </td>
                          <td className="tabular py-3 pr-3 text-right">{st.valid}</td>
                          <td className="tabular py-3 text-right">
                            {st.generated}/{st.valid}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>From spreadsheet to print-ready PDFs in four steps.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-4">
              {[
                { icon: FilePlus2, t: "Create a batch", d: "One batch per examination keeps data separate." },
                { icon: Upload, t: "Upload & map your CSV", d: "Any column names — map them to admit card fields." },
                { icon: Palette, t: "Brand your template", d: "Logo, colours, fields, photo and QR code." },
                { icon: Download, t: "Generate & download", d: "Individual PDFs, a ZIP with manifest, or one combined PDF." },
              ].map((x, i) => (
                <li key={x.t} className="flex gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{i + 1}</div>
                  <div>
                    <div className="text-sm font-semibold">{x.t}</div>
                    <div className="text-xs text-muted-foreground">{x.d}</div>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
