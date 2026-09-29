"use client";
import { useEffect, useState } from "react";
import { ArrowDownUp, Download, Eye, Search, ChevronLeft, ChevronRight, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { GenStatusBadge } from "@/components/app/status";
import { PreviewFrame } from "@/components/preview-frame";
import { cn } from "@/lib/utils";

export interface CandidateRow {
  id: string;
  batchId: string;
  batchName: string;
  rowNumber: number;
  name: string;
  rollNumber: string;
  applicationNumber: string;
  examName: string;
  recordStatus: string;
  flagged: boolean;
  genStatus: string;
  genError: string | null;
  errors: { field: string; message: string }[];
  fileName: string | null;
}

export function CandidateTable({
  batchId,
  batches,
  exams,
  refreshKey = 0,
  showBatch = !batchId,
  selectable = !!batchId,
}: {
  batchId?: string;
  batches?: { id: string; name: string }[];
  exams?: string[];
  refreshKey?: number;
  showBatch?: boolean;
  selectable?: boolean;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [batch, setBatch] = useState(batchId ?? "");
  const [exam, setExam] = useState("");
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" }>({ col: "row", dir: "asc" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: CandidateRow[]; total: number; pageSize: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<CandidateRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const query = (() => {
    const sp = new URLSearchParams({ page: String(page), pageSize: "25", sort: sort.col, dir: sort.dir });
    if (debounced) sp.set("q", debounced);
    if (status) sp.set("status", status);
    if (batch) sp.set("batchId", batch);
    if (exam) sp.set("exam", exam);
    return sp.toString();
  })();

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/candidates?${query}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
    return () => ctrl.abort();
  }, [query, refreshKey]);

  const toggleSort = (col: string) => setSort((s) => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const sortBtn = (col: string, label: string) => (
    <button className="inline-flex cursor-pointer items-center gap-1 font-semibold uppercase" onClick={() => toggleSort(col)} aria-label={`Sort by ${label}`}>
      {label}
      <ArrowDownUp className={cn("size-3", sort.col === col ? "text-brand" : "opacity-40")} aria-hidden />
    </button>
  );
  const selectable_ = selectable && batch;
  const doneOnPage = data?.rows.filter((r) => r.genStatus === "done") ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder="Search name, roll number or application number" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search candidates" />
        </div>
        {batches && !batchId && (
          <NativeSelect aria-label="Filter by batch" className="w-52" value={batch} onChange={(e) => (setBatch(e.target.value), setPage(1), setSelected(new Set()))}>
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
        )}
        {exams && exams.length > 0 && (
          <NativeSelect aria-label="Filter by exam" className="w-52" value={exam} onChange={(e) => (setExam(e.target.value), setPage(1))}>
            <option value="">All exams</option>
            {exams.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </NativeSelect>
        )}
        <NativeSelect aria-label="Filter by status" className="w-44" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
          <option value="">All statuses</option>
          <option value="done">Generated</option>
          <option value="pending">Not generated</option>
          <option value="in_progress">In progress</option>
          <option value="failed">Failed</option>
          <option value="invalid">Invalid</option>
          <option value="duplicate">Duplicate</option>
          <option value="flagged">Flagged</option>
        </NativeSelect>
      </div>

      {selectable_ && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-brand-soft px-3 py-2 text-sm">
          <b>{selected.size}</b> selected
          <form method="post" action={`/api/batches/${batch}/zip`}>
            <input type="hidden" name="ids" value={[...selected].join(",")} />
            <Button size="sm" variant="brand" type="submit">
              <FileArchive /> Download selected as ZIP
            </Button>
          </form>
          <form method="post" action={`/api/batches/${batch}/combined?sort=${sort.col === "name" ? "name" : sort.col === "roll" ? "roll" : "csv"}`} target="_blank">
            <input type="hidden" name="ids" value={[...selected].join(",")} />
            <Button size="sm" variant="outline" type="submit">
              <Download /> Combined PDF of selected
            </Button>
          </form>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-left text-[11px] tracking-wide text-muted-foreground">
            <tr>
              {selectable_ && (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    className="accent-[#4338ca]"
                    aria-label="Select all generated on this page"
                    checked={doneOnPage.length > 0 && doneOnPage.every((r) => selected.has(r.id))}
                    onChange={(e) =>
                      setSelected((s) => {
                        const n = new Set(s);
                        doneOnPage.forEach((r) => (e.target.checked ? n.add(r.id) : n.delete(r.id)));
                        return n;
                      })
                    }
                  />
                </th>
              )}
              <th className="px-3 py-2">
                {sortBtn("row", "#")}
              </th>
              <th className="px-3 py-2">
                {sortBtn("name", "Candidate")}
              </th>
              <th className="px-3 py-2">
                {sortBtn("roll", "Roll no.")}
              </th>
              <th className="hidden px-3 py-2 font-semibold uppercase md:table-cell">Application no.</th>
              {showBatch && <th className="hidden px-3 py-2 font-semibold uppercase lg:table-cell">Batch</th>}
              <th className="px-3 py-2">
                {sortBtn("status", "Status")}
              </th>
              <th className="px-3 py-2 text-right font-semibold uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!data &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td colSpan={8} className="px-3 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))}
            {data?.rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/40">
                {selectable_ && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="accent-[#4338ca]"
                      aria-label={`Select ${r.name}`}
                      disabled={r.genStatus !== "done"}
                      checked={selected.has(r.id)}
                      onChange={(e) =>
                        setSelected((s) => {
                          const n = new Set(s);
                          if (e.target.checked) n.add(r.id);
                          else n.delete(r.id);
                          return n;
                        })
                      }
                    />
                  </td>
                )}
                <td className="tabular px-3 py-2 text-muted-foreground">{r.rowNumber}</td>
                <td className="px-3 py-2">
                  <button className="cursor-pointer text-left font-semibold hover:text-brand hover:underline" onClick={() => setDetail(r)}>
                    {r.name || <span className="text-muted-foreground">(no name)</span>}
                  </button>
                  {(r.genError || r.errors.length > 0) && <div className="max-w-80 truncate text-xs text-danger" title={r.genError ?? r.errors.map((e) => e.message).join("; ")}>{r.genError ?? r.errors[0]?.message}</div>}
                </td>
                <td className="tabular px-3 py-2">{r.rollNumber || "—"}</td>
                <td className="tabular hidden px-3 py-2 md:table-cell">{r.applicationNumber || "—"}</td>
                {showBatch && <td className="hidden max-w-48 truncate px-3 py-2 text-muted-foreground lg:table-cell">{r.batchName}</td>}
                <td className="px-3 py-2">
                  <GenStatusBadge recordStatus={r.recordStatus} genStatus={r.genStatus} flagged={r.flagged} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Preview ${r.name}`} onClick={() => setDetail(r)} disabled={r.recordStatus !== "valid"}>
                      <Eye />
                    </Button>
                    {r.genStatus === "done" ? (
                      <Button variant="ghost" size="icon" className="size-8" asChild>
                        <a href={`/api/candidates/${r.id}/pdf`} aria-label={`Download PDF for ${r.name}`} download>
                          <Download />
                        </a>
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="size-8" disabled aria-label="PDF not generated yet">
                        <Download />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {data && data.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No candidates match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="tabular">{data ? `${data.total.toLocaleString()} candidate(s)` : "…"}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-8" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft />
          </Button>
          <span className="tabular">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="icon" className="size-8" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        {detail && (
          <DialogContent title={detail.name || "Candidate"} description={`Roll ${detail.rollNumber || "—"} · Application ${detail.applicationNumber || "—"} · ${detail.batchName}`} wide>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <GenStatusBadge recordStatus={detail.recordStatus} genStatus={detail.genStatus} flagged={detail.flagged} />
                {detail.fileName && <code className="text-xs text-muted-foreground">{detail.fileName}</code>}
                <div className="ml-auto flex gap-2">
                  {detail.genStatus === "done" && (
                    <>
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/api/candidates/${detail.id}/pdf?inline=1`} target="_blank" rel="noopener">
                          Open / print PDF
                        </a>
                      </Button>
                      <Button size="sm" asChild>
                        <a href={`/api/candidates/${detail.id}/pdf`} download>
                          <Download /> Download PDF
                        </a>
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {(detail.errors.length > 0 || detail.genError) && (
                <ul className="list-disc rounded-md bg-danger-soft py-2 pl-8 pr-3 text-sm text-danger">
                  {detail.genError && <li>{detail.genError}</li>}
                  {detail.errors.map((e, i) => (
                    <li key={i}>
                      <b>{e.field}</b>: {e.message}
                    </li>
                  ))}
                </ul>
              )}
              {detail.recordStatus === "valid" && (
                <div className="rounded-md bg-[#e9ebf2] p-3">
                  <PreviewFrame candidateId={detail.id} debounceMs={0} />
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
