import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEPS = ["Create batch", "Upload CSV", "Map & validate", "Template & branding", "Preview", "Generate", "Download"];

export function StepIndicator({ current, batchId, maxReached }: { current: number; batchId?: string; maxReached?: number }) {
  const reach = maxReached ?? current;
  return (
    <nav aria-label="Progress" className="mb-6 overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1 rounded-lg border border-border bg-card p-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const isCurrent = n === current;
          const clickable = batchId && n >= 2 && n <= reach && !isCurrent;
          const inner = (
            <>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-bold",
                  done ? "bg-success text-white" : isCurrent ? "bg-brand text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : n}
              </span>
              <span className={cn("text-xs font-semibold", isCurrent ? "text-foreground" : "text-muted-foreground")}>{label}</span>
            </>
          );
          return (
            <li key={label} className="flex items-center gap-1" aria-current={isCurrent ? "step" : undefined}>
              {clickable ? (
                <Link href={`/batches/${batchId}/setup?step=${n}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                  {inner}
                </Link>
              ) : (
                <span className={cn("flex items-center gap-2 rounded-md px-2 py-1.5", isCurrent && "bg-brand-soft")}>{inner}</span>
              )}
              {n < STEPS.length && <span className="mx-1 h-px w-4 bg-border" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
