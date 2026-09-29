"use client";
import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AssetRef } from "@/lib/template/types";
import { assetUrl } from "@/lib/template/asset-url";

export function AssetPicker({ label, value, onChange, kind, hint }: { label: string; value: AssetRef; onChange: (v: AssetRef) => void; kind: string; hint?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const url = assetUrl(value);
  const id = `asset-${label.replace(/\W+/g, "-").toLowerCase()}`;

  async function upload(f: File | undefined) {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Images must be 2 MB or smaller");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("kind", kind);
    try {
      const res = await fetch("/api/assets", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Upload failed");
      onChange(d.ref);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-[repeating-conic-gradient(#f1f2f6_0%_25%,#fff_0%_50%)] bg-[length:12px_12px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt={`${label} preview`} className="max-h-full max-w-full object-contain" /> : <span className="text-[10px] text-muted-foreground">None</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={ref} id={id} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={busy}>
            <ImagePlus /> {busy ? "Uploading…" : url ? "Replace" : "Upload"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <X /> Remove
            </Button>
          )}
        </div>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
