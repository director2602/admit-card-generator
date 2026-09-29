import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Upload } from "lucide-react";
import { requirePageSession } from "@/lib/auth/session";
import { getBatch } from "@/lib/services/batches";
import { PageHeader } from "@/components/app/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchStatusBadge } from "@/components/app/status";
import { GenerationPanel } from "@/components/batch/generation-panel";
import { DownloadsPanel } from "@/components/batch/downloads-panel";
import { CandidateTable } from "@/components/batch/candidate-table";
import { DeleteBatchButton } from "@/components/batch/delete-batch-button";

export const metadata = { title: "Batch" };

export default async function BatchPage(props: PageProps<"/batches/[id]">) {
  const s = await requirePageSession();
  const { id } = await props.params;
  const batch = await getBatch(s.orgId, id).catch(() => null);
  if (!batch) notFound();
  return (
    <>
      <PageHeader
        title={batch.name}
        description={[batch.examName, batch.session, batch.csvFileName && `from ${batch.csvFileName}`].filter(Boolean).join(" · ")}
        actions={
          <>
            <BatchStatusBadge status={batch.status} />
            <Button variant="outline" asChild>
              <Link href={`/batches/${batch.id}/setup?step=2`}>
                <Upload /> Upload corrected CSV
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/batches/${batch.id}/setup?step=4`}>
                <Pencil /> Edit design
              </Link>
            </Button>
            <DeleteBatchButton id={batch.id} name={batch.name} />
          </>
        }
      />
      {!batch.templateSnapshot ? (
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="text-sm">This batch is not set up yet.</div>
            <Button asChild>
              <Link href={`/batches/${batch.id}/setup?step=2`}>Continue setup</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mb-6 grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Generation</CardTitle>
              <CardDescription>Progress updates live. Retrying only touches failed records.</CardDescription>
            </CardHeader>
            <CardContent>
              <GenerationPanel batchId={batch.id} compact />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Downloads</CardTitle>
              <CardDescription>Individual PDFs, ZIP with manifest, or one combined print-ready PDF.</CardDescription>
            </CardHeader>
            <CardContent>
              <DownloadsPanel batchId={batch.id} />
            </CardContent>
          </Card>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Candidates</CardTitle>
          <CardDescription>
            Data retention: this batch and its files are deleted automatically on{" "}
            {batch.expiresAt ? batch.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CandidateTable batchId={batch.id} />
        </CardContent>
      </Card>
    </>
  );
}
