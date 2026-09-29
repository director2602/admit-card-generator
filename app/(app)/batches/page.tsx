import Link from "next/link";
import { Layers, FilePlus2 } from "lucide-react";
import { requirePageSession } from "@/lib/auth/session";
import { listBatches } from "@/lib/services/batches";
import { PageHeader } from "@/components/app/sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty";
import { BatchStatusBadge } from "@/components/app/status";
import { DemoButton } from "@/components/app/demo-button";

export const metadata = { title: "Generated batches" };

export default async function BatchesPage() {
  const s = await requirePageSession();
  const batches = await listBatches(s.orgId);
  return (
    <>
      <PageHeader
        title="Generated batches"
        description="Each examination batch keeps its own candidates, template snapshot and PDFs."
        actions={
          <Button asChild>
            <Link href="/create">
              <FilePlus2 /> New batch
            </Link>
          </Button>
        }
      />
      {batches.length === 0 ? (
        <EmptyState icon={<Layers />} title="No batches yet" body="Create a batch and upload a CSV, or load the demo batch to explore the workflow." action={<DemoButton />} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Batch</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="hidden px-4 py-3 text-right font-semibold md:table-cell">Records</th>
                <th className="hidden px-4 py-3 text-right font-semibold md:table-cell">Invalid</th>
                <th className="w-64 px-4 py-3 font-semibold">Generated</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link href={`/batches/${b.id}`} className="font-semibold hover:text-brand hover:underline">
                      {b.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{b.examName || "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <BatchStatusBadge status={b.status} />
                  </td>
                  <td className="tabular hidden px-4 py-3 text-right md:table-cell">{b.stats.total}</td>
                  <td className="tabular hidden px-4 py-3 text-right md:table-cell">{b.stats.invalid + b.stats.duplicate}</td>
                  <td className="px-4 py-3">
                    <div className="tabular mb-1 text-xs text-muted-foreground">
                      {b.stats.generated} / {b.stats.valid}
                    </div>
                    <Progress value={b.stats.valid ? (b.stats.generated / b.stats.valid) * 100 : 0} tone={b.stats.valid && b.stats.generated === b.stats.valid ? "success" : "brand"} label={`${b.name} progress`} />
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">{b.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
