"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface StatusRes {
  job: { id: string; status: string; total: number; completed: number; failed: number } | null;
}

export function ActiveJobs({ batchIds }: { batchIds: string[] }) {
  const router = useRouter();
  const [data, setData] = useState<Record<string, StatusRes>>({});
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const entries = await Promise.all(batchIds.map(async (id) => [id, await fetch(`/api/batches/${id}/status`).then((r) => r.json())] as const));
      if (stop) return;
      setData(Object.fromEntries(entries));
      if (entries.every(([, s]) => !s.job || !["queued", "running"].includes(s.job.status))) router.refresh();
      else setTimeout(tick, 1500);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [batchIds, router]);
  return (
    <Card className="mt-6">
      <CardContent className="flex flex-col gap-4 p-5">
        {batchIds.map((id) => {
          const j = data[id]?.job;
          const pct = j && j.total ? ((j.completed + j.failed) / j.total) * 100 : 0;
          return (
            <Link key={id} href={`/batches/${id}`} className="block rounded-md p-1 hover:bg-muted">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-semibold">
                  <Loader2 className="size-4 animate-spin text-brand" aria-hidden /> Generating admit cards…
                </span>
                <span className="tabular text-muted-foreground">{j ? `${j.completed + j.failed} / ${j.total}` : "…"}</span>
              </div>
              <Progress value={pct} label="Generation progress" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
