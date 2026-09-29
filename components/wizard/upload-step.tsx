"use client";
import { useRef, useState } from "react";
import { FileSpreadsheet, UploadCloud, Download, AlertTriangle, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseCsvFile } from "@/lib/csv/parse";
import { cn, formatBytes } from "@/lib/utils";
import type { ParsedFile, WizardBatch, BatchStats } from "./types";

const MAX_BYTES = 10 * 1024 * 1024;

export function UploadStep({
  batch,
  stats,
  parsed,
  onParsed,
  importMode,
  setImportMode,
  onNext,
}: {
  batch: WizardBatch;
  stats: BatchStats;
  parsed: ParsedFile | null;
  onParsed: (p: ParsedFile | null) => void;
  importMode: "replace" | "update";
  setImportMode: (m: "replace" | "update") => void;
  onNext: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setError("Please choose a .csv file. In Excel use File → Save As → CSV UTF-8.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`This file is ${formatBytes(file.size)}. The maximum is ${formatBytes(MAX_BYTES)}.`);
      return;
    }
    setBusy(true);
    try {
      const res = await parseCsvFile(file);
      if (!res.headers.length || !res.rows.length) {
        setError("No rows were found. Make sure the first line contains column headers.");
        onParsed(null);
      } else {
        onParsed({ name: file.name, size: file.size, encoding: res.encoding, headers: res.headers, rows: res.rows, warnings: res.errors });
      }
    } catch {
      setError("The file could not be read as CSV.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Step 2 · Upload candidate CSV</CardTitle>
          <CardDescription>One row per candidate, with column headers in the first row. Column names can be anything — you will map them next.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {stats.total > 0 && (
            <div className="rounded-lg border border-border bg-muted/60 p-4 text-sm">
              <div className="font-semibold">
                This batch already has {stats.total} records{batch.csvFileName ? ` from ${batch.csvFileName}` : ""}.
              </div>
              <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Import mode">
                {(
                  [
                    ["update", "Upload corrected CSV", "Updates changed rows (matched by roll number) and regenerates only those."],
                    ["replace", "Replace all records", "Discards existing records and generated PDFs."],
                  ] as const
                ).map(([v, label, hint]) => (
                  <label
                    key={v}
                    className={cn(
                      "flex min-w-56 flex-1 cursor-pointer gap-2 rounded-md border bg-card p-3",
                      importMode === v ? "border-brand ring-1 ring-brand" : "border-border",
                    )}
                  >
                    <input type="radio" name="importMode" className="mt-1 accent-[#4338ca]" checked={importMode === v} onChange={() => setImportMode(v)} />
                    <span>
                      <span className="block font-semibold">{label}</span>
                      <span className="text-xs text-muted-foreground">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              handle(e.dataTransfer.files[0]);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
              drag ? "border-brand bg-brand-soft" : "border-input bg-muted/40",
            )}
          >
            <div className="flex size-14 items-center justify-center rounded-full bg-card text-brand shadow-sm">
              <UploadCloud className="size-7" aria-hidden />
            </div>
            <div>
              <div className="font-bold">Drag and drop your CSV here</div>
              <div className="text-sm text-muted-foreground">UTF-8, UTF-16 or Windows-1252 · up to 10 MB · up to 20,000 rows</div>
            </div>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" id="csv-file" onChange={(e) => handle(e.target.files?.[0])} />
            <Button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
              <FileSpreadsheet /> {busy ? "Reading file…" : "Choose CSV file"}
            </Button>
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
            </p>
          )}

          {parsed && (
            <div className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-md bg-success-soft text-success">
                    <FileSpreadsheet className="size-5" aria-hidden />
                  </div>
                  <div>
                    <div className="font-semibold">{parsed.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(parsed.size)} · {parsed.encoding} · {parsed.headers.length} columns
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="success" className="text-sm">
                    {parsed.rows.length.toLocaleString()} records detected
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => onParsed(null)}>
                    <RotateCcw /> Change
                  </Button>
                </div>
              </div>
              {parsed.warnings.length > 0 && (
                <ul className="mt-3 list-disc pl-5 text-xs text-warning">
                  {parsed.warnings.slice(0, 5).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {parsed.headers.map((h) => (
                  <span key={h} className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button size="lg" onClick={onNext} disabled={!parsed}>
              Continue to mapping
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-sm">Sample files</CardTitle>
          <CardDescription>All sample data is fictional.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {[
            ["blank-template.csv", "Blank template with headers"],
            ["sample-candidates-10.csv", "10 sample candidates"],
            ["demo-candidates-100.csv", "100 demo candidates"],
            ["sample-with-errors.csv", "Sample with invalid rows"],
          ].map(([f, label]) => (
            <a key={f} href={`/samples/${f}`} download className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
              <Download className="size-4 text-brand" aria-hidden /> {label}
            </a>
          ))}
          <p className="mt-2 text-xs text-muted-foreground">
            Photos can be <b>https:// URLs</b> or <b>file names</b> (e.g. <code>photo_ROLL0001.jpg</code>) that you upload as images or a ZIP in the next step.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
