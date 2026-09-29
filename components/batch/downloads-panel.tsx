"use client";
import { useState } from "react";
import { FileArchive, FileStack, Printer, FileWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { useBatchStatus } from "./generation-panel";

export function DownloadsPanel({ batchId }: { batchId: string }) {
  const { data } = useBatchStatus(batchId);
  const [sort, setSort] = useState<"csv" | "roll" | "name">("roll");
  const [building, setBuilding] = useState<null | "download" | "print">(null);
  const generated = data?.stats.generated ?? 0;
  const disabled = generated === 0;

  async function combined(mode: "download" | "print") {
    setBuilding(mode);
    // The server builds (and caches) the merged PDF on first request.
    const printWin = mode === "print" ? window.open("about:blank", "_blank") : null;
    try {
      const url = `/api/batches/${batchId}/combined?sort=${sort}${mode === "print" ? "&inline=1" : ""}`;
      if (printWin) printWin.location.href = url;
      else {
        const a = document.createElement("a");
        a.href = url;
        a.click();
      }
    } catch (e) {
      printWin?.close();
      toast.error((e as Error).message);
    } finally {
      setTimeout(() => setBuilding(null), 1500);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-brand-soft text-brand">
            <FileArchive className="size-5" aria-hidden />
          </div>
          <div>
            <div className="font-bold">ZIP of individual PDFs</div>
            <div className="text-xs text-muted-foreground">{generated.toLocaleString()} PDFs + manifest.csv with statuses</div>
          </div>
        </div>
        <Button asChild={!disabled} disabled={disabled} variant="brand">
          {disabled ? <span>Download ZIP</span> : <a href={`/api/batches/${batchId}/zip`}>Download ZIP</a>}
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-brand-soft text-brand">
            <FileStack className="size-5" aria-hidden />
          </div>
          <div className="flex-1">
            <div className="font-bold">Combined print-ready PDF</div>
            <div className="text-xs text-muted-foreground">Every card in one file at exact print size.</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect aria-label="Sort order" className="h-10 w-44" value={sort} onChange={(e) => setSort(e.target.value as "csv")}>
            <option value="roll">Sort by roll number</option>
            <option value="name">Sort by name</option>
            <option value="csv">CSV order</option>
          </NativeSelect>
          <Button variant="outline" disabled={disabled || !!building} onClick={() => combined("download")}>
            {building === "download" ? <Loader2 className="animate-spin" /> : <FileStack />} Download
          </Button>
          <Button variant="outline" disabled={disabled || !!building} onClick={() => combined("print")}>
            {building === "print" ? <Loader2 className="animate-spin" /> : <Printer />} Print
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">When printing, choose “Actual size” (100%) and turn off browser headers/footers.</p>
      </div>

      <a
        href={`/api/batches/${batchId}/errors`}
        className="flex items-center gap-3 rounded-lg border border-dashed border-input p-3 text-sm hover:bg-muted md:col-span-2"
      >
        <FileWarning className="size-4 text-warning" aria-hidden />
        Download error report (invalid, duplicate, flagged and failed records)
      </a>
    </div>
  );
}
