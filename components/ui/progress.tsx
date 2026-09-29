import { cn } from "@/lib/utils";

export function Progress({ value, className, tone = "brand", label }: { value: number; className?: string; tone?: "brand" | "success" | "danger"; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const color = tone === "success" ? "bg-success" : tone === "danger" ? "bg-danger" : "bg-brand";
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-label={label}
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${v}%` }} />
    </div>
  );
}
