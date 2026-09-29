"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Plus, Save, Trash2, Copy, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { autoMap, slugKey, STANDARD_FIELDS, type FieldMapping, type MappingSource } from "@/lib/fields";
import { validateRows, type DuplicatePolicy } from "@/lib/csv/validate";
import { toCsv } from "@/lib/security/sanitize";
import { cn, jsonFetch } from "@/lib/utils";
import { PhotosUpload } from "./photos-upload";
import type { ParsedFile, PresetSummary, WizardBatch } from "./types";

function srcValue(s: MappingSource | undefined): string {
  if (!s || s.type === "none") return "__none";
  if (s.type === "constant") return "__const";
  return `col:${s.column}`;
}

export function MappingStep({
  batch,
  parsed,
  presets: initialPresets,
  importMode,
  photoCount,
  onImported,
  onBack,
}: {
  batch: WizardBatch;
  parsed: ParsedFile;
  presets: PresetSummary[];
  importMode: "replace" | "update";
  photoCount: number;
  onImported: () => void;
  onBack: () => void;
}) {
  const [mapping, setMapping] = useState<FieldMapping>(() => {
    const auto = autoMap(parsed.headers);
    // Pre-fill exam name from the batch when the CSV has no exam column.
    if (auto.fields.exam_name?.type === "none" && batch.examName) auto.fields.exam_name = { type: "constant", value: batch.examName };
    return auto;
  });
  const [presets, setPresets] = useState(initialPresets);
  const [policy, setPolicy] = useState<DuplicatePolicy>("skip");
  const [resolutions, setResolutions] = useState<Record<string, number>>({});
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newCustom, setNewCustom] = useState({ label: "", column: "" });

  const result = useMemo(() => validateRows(parsed.rows, mapping, policy, resolutions), [parsed.rows, mapping, policy, resolutions]);
  const { summary } = result;
  const first = parsed.rows[0] ?? {};

  const setField = (key: string, v: string, constant?: string) => {
    setMapping((m) => {
      const fields = { ...m.fields };
      if (v === "__none") fields[key] = { type: "none" };
      else if (v === "__const") fields[key] = { type: "constant", value: constant ?? (m.fields[key]?.type === "constant" ? (m.fields[key] as { value: string }).value : "") };
      else fields[key] = { type: "column", column: v.slice(4) };
      return { ...m, fields };
    });
  };

  const toggleRequired = (key: string, on: boolean) =>
    setMapping((m) => {
      if (m.customFields.some((c) => c.key === key)) {
        return { ...m, customFields: m.customFields.map((c) => (c.key === key ? { ...c, required: on } : c)) };
      }
      const set = new Set(m.extraRequired ?? []);
      if (on) set.add(key);
      else set.delete(key);
      return { ...m, extraRequired: [...set] };
    });

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    const cols = new Set(parsed.headers);
    const fields: Record<string, MappingSource> = {};
    for (const [k, v] of Object.entries(p.mapping.fields)) fields[k] = v.type === "column" && !cols.has(v.column) ? { type: "none" } : v;
    setMapping({ fields, customFields: p.mapping.customFields, extraRequired: p.mapping.extraRequired });
    toast.success(`Applied mapping preset “${p.name}”`);
  };

  async function savePreset() {
    const name = window.prompt("Name this mapping preset", batch.name);
    if (!name) return;
    try {
      const { preset } = await jsonFetch<{ preset: PresetSummary }>("/api/mapping-presets", { method: "POST", json: { name, mapping } });
      setPresets((p) => [...p, preset]);
      toast.success("Mapping saved for reuse");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function downloadErrors() {
    const bad = result.records.filter((r) => r.status !== "valid" || r.flagged);
    const csv = toCsv([
      ["row_number", "roll_number", "candidate_name", "status", "field", "error"],
      ...bad.flatMap((r) => r.errors.map((e) => [r.rowNumber, r.data.roll_number ?? "", r.data.candidate_name ?? "", r.status, e.field, e.message])),
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "validation-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function doImport() {
    setBusy(true);
    try {
      const res = await jsonFetch<{ summary: { valid: number }; changed: number; unchanged: number }>(`/api/batches/${batch.id}/import`, {
        method: "POST",
        json: { rows: parsed.rows, mapping, policy, resolutions, fileName: parsed.name, fileSize: parsed.size, mode: importMode },
      });
      toast.success(
        importMode === "update"
          ? `Imported: ${res.changed} new or changed records, ${res.unchanged} unchanged`
          : `Imported ${res.summary.valid} valid candidates`,
      );
      onImported();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  const requiredSet = new Set([
    ...STANDARD_FIELDS.filter((f) => f.required).map((f) => f.key),
    ...(mapping.extraRequired ?? []),
    ...mapping.customFields.filter((c) => c.required).map((c) => c.key),
  ]);
  const usesFiles = ["photo", "signature"].some((k) => {
    const s = mapping.fields[k];
    return s?.type === "column" && parsed.rows.slice(0, 50).some((r) => /\.(png|jpe?g|webp)$/i.test(String(r[s.column] ?? "")) && !/^https?:/i.test(String(r[s.column])));
  });
  const previewRows = (onlyProblems ? result.records.filter((r) => r.status !== "valid" || r.flagged) : result.records).slice(0, 20);
  const previewCols = ["candidate_name", "roll_number", "application_number", "date_of_birth", "exam_date", ...mapping.customFields.slice(0, 2).map((c) => c.key)];

  const fieldRow = (key: string, label: string, isCustom: boolean) => {
    const src = mapping.fields[key];
    const v = srcValue(src);
    const sample = src?.type === "column" ? String(first[src.column] ?? "") : src?.type === "constant" ? src.value : "";
    const locked = STANDARD_FIELDS.find((f) => f.key === key)?.required;
    return (
      <tr key={key} className="border-b border-border last:border-0">
        <td className="py-2 pr-3 align-top">
          <div className="text-sm font-semibold">
            {label}
            {requiredSet.has(key) && <span className="ml-1 text-danger" aria-label="required">*</span>}
          </div>
          {isCustom && <div className="text-[11px] text-muted-foreground">custom · {`{{${key}}}`}</div>}
        </td>
        <td className="py-2 pr-3 align-top">
          <div className="flex flex-col gap-1.5">
            <NativeSelect aria-label={`Source for ${label}`} value={v} onChange={(e) => setField(key, e.target.value)} className="h-9">
              <option value="__none">— Not used —</option>
              <option value="__const">Same value for everyone…</option>
              <optgroup label="CSV columns">
                {parsed.headers.map((h) => (
                  <option key={h} value={`col:${h}`}>
                    {h}
                  </option>
                ))}
              </optgroup>
            </NativeSelect>
            {src?.type === "constant" && (
              <Input className="h-9" aria-label={`Fixed value for ${label}`} placeholder="Value printed on every card" value={src.value} onChange={(e) => setField(key, "__const", e.target.value)} />
            )}
          </div>
        </td>
        <td className="hidden max-w-56 truncate py-2 pr-3 align-top text-xs text-muted-foreground md:table-cell" title={sample}>
          {sample || "—"}
        </td>
        <td className="py-2 align-top">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" className="accent-brand" disabled={!!locked} checked={requiredSet.has(key)} onChange={(e) => toggleRequired(key, e.target.checked)} />
              Required
            </label>
            {isCustom && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${label}`}
                onClick={() =>
                  setMapping((m) => {
                    const fields = { ...m.fields };
                    delete fields[key];
                    return { ...m, fields, customFields: m.customFields.filter((c) => c.key !== key) };
                  })
                }
              >
                <Trash2 />
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Step 3 · Map columns to admit card fields</CardTitle>
            <CardDescription>
              We matched {Object.values(mapping.fields).filter((s) => s.type === "column").length} of {parsed.headers.length} columns automatically. Check each field below.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.length > 0 && (
              <NativeSelect aria-label="Apply saved mapping" className="h-9 w-48" defaultValue="" onChange={(e) => applyPreset(e.target.value)}>
                <option value="" disabled>
                  Apply saved mapping…
                </option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            )}
            <Button variant="outline" size="sm" className="h-9" onClick={savePreset}>
              <Save /> Save mapping
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="w-56 py-2 pr-3 font-semibold">Admit card field</th>
                  <th className="py-2 pr-3 font-semibold">Source</th>
                  <th className="hidden py-2 pr-3 font-semibold md:table-cell">Row 1 value</th>
                  <th className="w-40 py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {STANDARD_FIELDS.map((f) => fieldRow(f.key, f.label, false))}
                {mapping.customFields.map((c) => fieldRow(c.key, c.label, true))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg bg-muted/60 p-3">
            <div className="flex min-w-44 flex-1 flex-col gap-1">
              <label htmlFor="cf-label" className="text-xs font-semibold">
                Add custom field
              </label>
              <Input id="cf-label" className="h-9" placeholder="Label, e.g. Class" value={newCustom.label} onChange={(e) => setNewCustom((s) => ({ ...s, label: e.target.value }))} />
            </div>
            <NativeSelect aria-label="Column for custom field" className="h-9 w-52" value={newCustom.column} onChange={(e) => setNewCustom((s) => ({ ...s, column: e.target.value }))}>
              <option value="">Choose column…</option>
              {parsed.headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </NativeSelect>
            <Button
              variant="outline"
              className="h-9"
              disabled={!newCustom.label.trim() || !newCustom.column}
              onClick={() => {
                let key = slugKey(newCustom.label);
                while (mapping.fields[key]) key += "_2";
                setMapping((m) => ({
                  ...m,
                  customFields: [...m.customFields, { key, label: newCustom.label.trim() }],
                  fields: { ...m.fields, [key]: { type: "column", column: newCustom.column } },
                }));
                setNewCustom({ label: "", column: "" });
              }}
            >
              <Plus /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {usesFiles && <PhotosUpload batchId={batch.id} initialCount={photoCount} />}

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Validation</CardTitle>
            <CardDescription>Invalid rows are reported and skipped — they never stop the rest of the batch.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={downloadErrors} disabled={summary.invalid + summary.duplicates + summary.flagged === 0}>
            <Download /> Error report (CSV)
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { l: "Total rows", v: summary.total, c: "" },
              { l: "Valid", v: summary.valid, c: "text-success" },
              { l: "Invalid", v: summary.invalid, c: "text-danger" },
              { l: policy === "flag" ? "Flagged duplicates" : "Duplicates skipped", v: policy === "flag" ? summary.flagged : summary.duplicates, c: "text-warning" },
            ].map((t) => (
              <div key={t.l} className="rounded-lg border border-border p-3">
                <div className={cn("tabular text-2xl font-extrabold", t.c)}>{t.v}</div>
                <div className="text-xs text-muted-foreground">{t.l}</div>
              </div>
            ))}
          </div>

          <fieldset className="rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-semibold">Duplicate roll / application numbers</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {(
                [
                  ["skip", "Skip duplicates (keep first)"],
                  ["flag", "Import all and flag"],
                  ["manual", "Resolve manually"],
                ] as const
              ).map(([v, l]) => (
                <label key={v} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="dup" className="accent-brand" checked={policy === v} onChange={() => setPolicy(v)} /> {l}
                </label>
              ))}
            </div>
            {policy === "manual" && summary.duplicateGroups.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {summary.duplicateGroups.map((g) => (
                  <div key={g.key} className="flex flex-wrap items-center gap-3 rounded-md bg-warning-soft px-3 py-2 text-sm">
                    <Copy className="size-4 text-warning" aria-hidden />
                    <span className="font-semibold">{g.key.replace("_", " ").replace(":", " ")}</span>
                    <span className="text-muted-foreground">keep row:</span>
                    {g.rows.map((rn) => (
                      <label key={rn} className="flex items-center gap-1">
                        <input
                          type="radio"
                          className="accent-brand"
                          name={`res-${g.key}`}
                          checked={resolutions[g.key] === rn}
                          onChange={() => setResolutions((r) => ({ ...r, [g.key]: rn }))}
                        />
                        {rn} ({result.records[rn - 1]?.data.candidate_name || "no name"})
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {policy === "manual" && summary.duplicateGroups.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No duplicates found.</p>}
          </fieldset>

          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Preview (first 20 rows)</div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" className="accent-brand" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> Only rows with problems
            </label>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/70">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold">Row</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  {previewCols.map((k) => (
                    <th key={k} className="px-3 py-2 font-semibold whitespace-nowrap">
                      {STANDARD_FIELDS.find((f) => f.key === k)?.label ?? mapping.customFields.find((c) => c.key === k)?.label ?? k}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-semibold">Issues</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.rowNumber} className={cn("border-t border-border", r.status !== "valid" && "bg-danger-soft/40")}>
                    <td className="tabular px-3 py-2">{r.rowNumber}</td>
                    <td className="px-3 py-2">
                      {r.status === "valid" ? (
                        r.flagged ? (
                          <Badge tone="warning">Flagged</Badge>
                        ) : (
                          <CheckCircle2 className="size-4 text-success" aria-label="Valid" />
                        )
                      ) : (
                        <Badge tone={r.status === "invalid" ? "danger" : "warning"}>{r.status === "invalid" ? "Invalid" : "Duplicate"}</Badge>
                      )}
                    </td>
                    {previewCols.map((k) => (
                      <td key={k} className="max-w-48 truncate px-3 py-2 whitespace-nowrap">
                        {r.data[k] || <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-danger">{r.errors.map((e) => e.message).join("; ")}</td>
                  </tr>
                ))}
                {previewRows.length === 0 && (
                  <tr>
                    <td colSpan={previewCols.length + 3} className="px-3 py-6 text-center text-muted-foreground">
                      No rows with problems.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {summary.valid === 0 && (
            <p className="flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              <AlertTriangle className="size-4" aria-hidden /> No valid rows yet — map Candidate Name and Roll Number to continue.
            </p>
          )}
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button size="lg" onClick={doImport} disabled={busy || summary.valid === 0}>
              {busy ? "Importing…" : `Import ${summary.valid.toLocaleString()} valid records`} <ArrowRight />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
