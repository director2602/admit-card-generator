"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { TemplateConfig } from "@/lib/template/types";
import { pageDims } from "@/lib/template/defaults";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MM = 96 / 25.4;

/**
 * Renders the server-generated card HTML (same renderer as the PDFs) in a
 * script-less sandboxed iframe, scaled to fit the container width.
 */
export function PreviewFrame({
  template,
  batchId,
  candidateId,
  count = 1,
  debounceMs = 350,
  className,
}: {
  template?: TemplateConfig;
  batchId?: string;
  candidateId?: string;
  count?: number;
  debounceMs?: number;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [width, setWidth] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [pageMm, setPageMm] = useState<{ w: number; h: number }>(template ? pageDims(template) : { w: 210, h: 297 });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const key = JSON.stringify({ template, batchId, candidateId, count });
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ template, batchId, candidateId, count }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? "Preview failed");
        }
        const w = Number(res.headers.get("x-page-width-mm"));
        const h = Number(res.headers.get("x-page-height-mm"));
        if (w && h) setPageMm({ w, h });
        setHtml(await res.text());
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    }, debounceMs);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, debounceMs]);

  const pagePx = pageMm.w * MM;
  const scale = width ? Math.min(1, width / pagePx) : 0.5;
  const naturalH = contentH || pageMm.h * MM * count;

  return (
    <div ref={wrap} className={cn("w-full min-w-0 overflow-hidden", className)}>
      {error && (
        <div role="alert" className="rounded-md bg-danger-soft p-4 text-sm text-danger">
          {error}
        </div>
      )}
      {!html && !error && <Skeleton className="aspect-[1/1.3] w-full" />}
      {html && (
        <div className="relative overflow-hidden" style={{ height: naturalH * scale }}>
          {loading && (
            <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium shadow">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Updating
            </div>
          )}
          <iframe
            ref={frame}
            title="Admit card preview"
            sandbox="allow-same-origin"
            srcDoc={html}
            onLoad={() => {
              const doc = frame.current?.contentDocument;
              if (doc) setContentH(doc.documentElement.scrollHeight);
              setLoading(false);
            }}
            style={{ width: pagePx + 2, height: naturalH, transform: `scale(${scale})`, transformOrigin: "0 0", border: 0, display: "block" }}
          />
        </div>
      )}
    </div>
  );
}
