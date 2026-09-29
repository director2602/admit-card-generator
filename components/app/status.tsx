import { Badge } from "@/components/ui/badge";

const BATCH: Record<string, { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" }> = {
  draft: { label: "Draft", tone: "neutral" },
  imported: { label: "Ready to generate", tone: "brand" },
  generating: { label: "Generating", tone: "brand" },
  completed: { label: "Completed", tone: "success" },
  completed_with_errors: { label: "Needs attention", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function BatchStatusBadge({ status }: { status: string }) {
  const s = BATCH[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function GenStatusBadge({ recordStatus, genStatus, flagged }: { recordStatus: string; genStatus: string; flagged?: boolean }) {
  if (recordStatus === "invalid") return <Badge tone="danger">Invalid</Badge>;
  if (recordStatus === "duplicate") return <Badge tone="warning">Duplicate</Badge>;
  const flag = flagged ? <Badge tone="warning">Flagged</Badge> : null;
  const main =
    genStatus === "done" ? (
      <Badge tone="success">Generated</Badge>
    ) : genStatus === "failed" ? (
      <Badge tone="danger">Failed</Badge>
    ) : genStatus === "queued" || genStatus === "processing" ? (
      <Badge tone="brand">{genStatus === "queued" ? "Queued" : "Rendering"}</Badge>
    ) : (
      <Badge>Not generated</Badge>
    );
  return (
    <span className="inline-flex gap-1">
      {main}
      {flag}
    </span>
  );
}
