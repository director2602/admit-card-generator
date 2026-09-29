"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileSpreadsheet, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PreviewFrame } from "@/components/preview-frame";
import { GenerationPanel } from "@/components/batch/generation-panel";
import { DownloadsPanel } from "@/components/batch/downloads-panel";
import { CandidateTable } from "@/components/batch/candidate-table";
import { StepIndicator } from "./step-indicator";
import { UploadStep } from "./upload-step";
import { MappingStep } from "./mapping-step";
import { TemplateStep } from "./template-step";
import type { BatchStats, ParsedFile, PresetSummary, TemplateSummary, WizardBatch } from "./types";

export function Wizard({
  step,
  batch,
  stats,
  templates,
  presets,
  photoCount,
}: {
  step: number;
  batch: WizardBatch;
  stats: BatchStats;
  templates: TemplateSummary[];
  presets: PresetSummary[];
  photoCount: number;
}) {
  const router = useRouter();
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [importMode, setImportMode] = useState<"replace" | "update">(stats.total > 0 ? "update" : "replace");
  const [genKey, setGenKey] = useState(0);

  // The URL (?step=N) is the source of truth; the server re-renders with fresh stats on each step.
  const go = (n: number) => {
    router.push(`/batches/${batch.id}/setup?step=${n}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const hasData = stats.valid > 0;
  const maxReached = !hasData ? 2 : !batch.hasTemplate ? 4 : 7;
  // Guard steps that need earlier data (e.g. page reload on step 3 loses the in-memory CSV).
  let s = step;
  if (s === 3 && !parsed) s = hasData ? 3 : 2;
  if (s >= 4 && !hasData) s = 2;
  if (s >= 5 && !batch.hasTemplate) s = 4;

  return (
    <>
      <StepIndicator current={s} batchId={batch.id} maxReached={Math.max(maxReached, s)} />
      {batch.isDemo && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
          <Info className="size-4 shrink-0" aria-hidden /> Demo batch — every candidate, photo and number here is fictional.
        </div>
      )}

      {s === 2 && <UploadStep batch={batch} stats={stats} parsed={parsed} onParsed={setParsed} importMode={importMode} setImportMode={setImportMode} onNext={() => go(3)} />}

      {s === 3 && parsed && (
        <MappingStep
          batch={batch}
          parsed={parsed}
          presets={presets}
          importMode={importMode}
          photoCount={photoCount}
          onBack={() => go(2)}
          onImported={() => {
            go(4);
            router.refresh();
          }}
        />
      )}
      {s === 3 && !parsed && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3 · Map & validate</CardTitle>
            <CardDescription>
              {stats.total.toLocaleString()} records are already imported ({stats.valid} valid, {stats.invalid} invalid, {stats.duplicate} duplicates). Upload the CSV again to change the mapping.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => go(2)}>
              <FileSpreadsheet /> Upload CSV again
            </Button>
            <Button onClick={() => go(4)}>
              Continue <ArrowRight />
            </Button>
          </CardContent>
        </Card>
      )}

      {s === 4 && (
        <TemplateStep
          batch={batch}
          templates={templates}
          onBack={() => go(3)}
          onApplied={() => {
            go(5);
            router.refresh();
          }}
        />
      )}

      {s === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 5 · Preview sample admit cards</CardTitle>
            <CardDescription>The first three valid candidates, rendered exactly as they will appear in the PDF.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-md bg-[#e9ebf2] p-3">
              <PreviewFrame batchId={batch.id} count={3} debounceMs={0} />
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="outline" onClick={() => go(4)}>
                Edit design
              </Button>
              <Button size="lg" onClick={() => go(6)}>
                Looks good — continue <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {s === 6 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 6 · Generate admit cards</CardTitle>
            <CardDescription>
              PDFs are rendered on the server in the background — you can leave this page and come back. Only valid records are generated.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <GenerationPanel batchId={batch.id} onDone={() => setGenKey((k) => k + 1)} />
            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="outline" onClick={() => go(5)}>
                Back
              </Button>
              <Button size="lg" onClick={() => go(7)}>
                Go to downloads <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {s === 7 && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Step 7 · Download</CardTitle>
              <CardDescription>Download everything at once, or search for a single candidate below.</CardDescription>
            </CardHeader>
            <CardContent>
              <DownloadsPanel batchId={batch.id} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Candidates</CardTitle>
                <CardDescription>Search, preview and download individual admit cards. Select rows to download a subset.</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/batches/${batch.id}`}>Batch details</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <CandidateTable batchId={batch.id} refreshKey={genKey} />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
