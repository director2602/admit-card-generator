"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Play, RefreshCw, Square, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/ui/dialog";
import { formatDuration, jsonFetch } from "@/lib/utils";
import type { BatchStats } from "@/lib/services/batch-stats-type";

interface JobInfo {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  total: number;
  completed: number;
  failed: number;
  error: string | null;
  elapsedMs: number;
}
interface StatusRes {
  status: string;
  stats: BatchStats;
  job: JobInfo | null;
  etaSeconds: number | null;
}

export function useBatchStatus(batchId: string, initial?: Partial<StatusRes>) {
  const [data, setData] = useState<StatusRes | null>(initial?.stats ? (initial as StatusRes) : null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(async () => {
    try {
      const d = await jsonFetch<StatusRes>(`/api/batches/${batchId}/status`);
      setData(d);
      return d;
    } catch {
      return null;
    }
  }, [batchId]);
  useEffect(() => {
    let stop = false;
    const loop = async () => {
      const d = await refresh();
      if (stop) return;
      const active = d?.job && ["queued", "running"].includes(d.job.status);
      timer.current = setTimeout(loop, active ? 1000 : 5000);
    };
    loop();
    return () => {
      stop = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);
  return { data, refresh };
}

export function GenerationPanel({ batchId, onDone, compact }: { batchId: string; onDone?: () => void; compact?: boolean }) {
  const router = useRouter();
  const { data, refresh } = useBatchStatus(batchId);
  const [busy, setBusy] = useState(false);
  const wasActive = useRef(false);

  const job = data?.job;
  const active = !!job && ["queued", "running"].includes(job.status);
  useEffect(() => {
    if (active) wasActive.current = true;
    else if (wasActive.current && job) {
      wasActive.current = false;
      if (job.status === "completed") toast.success(`Generated ${job.completed} admit card(s)${job.failed ? `, ${job.failed} failed` : ""}`);
      router.refresh();
      onDone?.();
    }
  }, [active, job, router, onDone]);

  async function start(mode: "pending" | "failed" | "all") {
    setBusy(true);
    try {
      await jsonFetch(`/api/batches/${batchId}/generate`, { method: "POST", json: { mode } });
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!job) return;
    try {
      await jsonFetch(`/api/jobs/${job.id}/cancel`, { method: "POST" });
      toast.message("Cancelling — finishing the cards currently rendering…");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!data) return <div className="h-28 animate-pulse rounded-lg bg-muted" />;
  const s = data.stats;
  const processed = job ? job.completed + job.failed : 0;
  const pct = active && job?.total ? (processed / job.total) * 100 : s.valid ? (s.generated / s.valid) * 100 : 0;
  const remaining = s.pending + s.failed;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: "Valid candidates", v: s.valid, c: "" },
          { l: "Generated", v: s.generated, c: "text-success" },
          { l: "Failed", v: s.failed, c: s.failed ? "text-danger" : "" },
          { l: "Not generated yet", v: s.pending + s.inProgress, c: "" },
        ].map((t) => (
          <div key={t.l} className="rounded-lg border border-border p-3">
            <div className={`tabular text-2xl font-extrabold ${t.c}`}>{t.v.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{t.l}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2 font-semibold" aria-live="polite">
            {active ? (
              <>
                <Loader2 className="size-4 animate-spin text-brand" aria-hidden /> {job!.status === "queued" ? "Queued…" : `Generating ${processed.toLocaleString()} of ${job!.total.toLocaleString()}`}
              </>
            ) : s.valid > 0 && s.generated === s.valid ? (
              <>
                <CheckCircle2 className="size-4 text-success" aria-hidden /> All {s.generated.toLocaleString()} admit cards generated
              </>
            ) : job?.status === "cancelled" ? (
              <>
                <XCircle className="size-4 text-muted-foreground" aria-hidden /> Generation cancelled
              </>
            ) : job?.status === "failed" ? (
              <>
                <XCircle className="size-4 text-danger" aria-hidden /> {job.error ?? "Generation stopped"}
              </>
            ) : (
              <>Ready to generate {remaining.toLocaleString()} admit card(s)</>
            )}
          </span>
          {active && (
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              {job!.failed > 0 && <span className="text-danger">{job!.failed} failed</span>}
              {data.etaSeconds !== null && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden /> ~{formatDuration(data.etaSeconds)} left
                </span>
              )}
            </span>
          )}
        </div>
        <Progress value={pct} tone={!active && s.failed ? "danger" : !active && s.generated === s.valid && s.valid > 0 ? "success" : "brand"} label="Generation progress" />
        <div className="mt-4 flex flex-wrap gap-2">
          {active ? (
            <Button variant="outline" onClick={cancel}>
              <Square /> Cancel
            </Button>
          ) : (
            <>
              {remaining > 0 && (
                <Button size={compact ? "default" : "lg"} variant="brand" onClick={() => start("pending")} disabled={busy}>
                  <Play /> {s.generated > 0 ? `Generate remaining ${remaining.toLocaleString()}` : `Generate ${remaining.toLocaleString()} admit cards`}
                </Button>
              )}
              {s.failed > 0 && (
                <Button variant="outline" onClick={() => start("failed")} disabled={busy}>
                  <RefreshCw /> Retry {s.failed} failed
                </Button>
              )}
              {s.generated > 0 && (
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" disabled={busy}>
                      <RefreshCw /> Regenerate all
                    </Button>
                  }
                  title="Regenerate every admit card?"
                  description={`All ${s.valid} PDFs will be rendered again with the current template. Existing files are replaced.`}
                  confirmLabel="Regenerate all"
                  destructive={false}
                  onConfirm={() => start("all")}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
