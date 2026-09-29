"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { STANDARD_FIELDS, slugKey } from "@/lib/fields";
import type { FieldSlot, SectionConfig, TemplateConfig } from "@/lib/template/types";
import { cn } from "@/lib/utils";

const AUTH_FIELDS: { key: string; label: string }[] = [
  { key: "sig_candidate", label: "Candidate's Signature" },
  { key: "sig_invigilator", label: "Invigilator's Signature" },
  { key: "sig_authority", label: "Authorised Signatory" },
];

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from === to) return arr;
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
}

export function FieldsEditor({ config, onChange }: { config: TemplateConfig; onChange: (c: TemplateConfig) => void }) {
  const [dragSec, setDragSec] = useState<number | null>(null);
  const setSections = (sections: SectionConfig[]) => onChange({ ...config, sections });
  const setSection = (i: number, patch: Partial<SectionConfig>) => setSections(config.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const panel = config.layout === "panel";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Drag sections and fields to reorder (or use the arrow buttons). Fields with no data for a candidate are hidden automatically — no empty labels are printed.
        {panel && " In the three-panel layout all visible fields flow into the centre panel in this order."}
      </p>
      {config.sections.map((sec, i) => (
        <div
          key={sec.id}
          className={cn("rounded-lg border border-border bg-card", dragSec === i && "opacity-50")}
          onDragOver={(e) => {
            if (dragSec !== null) e.preventDefault();
          }}
          onDrop={() => {
            if (dragSec !== null) setSections(move(config.sections, dragSec, i));
            setDragSec(null);
          }}
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/50 px-2 py-2">
            <span draggable onDragStart={() => setDragSec(i)} onDragEnd={() => setDragSec(null)} className="cursor-grab text-muted-foreground" aria-hidden>
              <GripVertical className="size-4" />
            </span>
            <Input className="h-8 min-w-32 flex-1 font-semibold" aria-label="Section title" value={sec.title} onChange={(e) => setSection(i, { title: e.target.value })} />
            <NativeSelect className="h-8 w-24" aria-label="Columns" value={sec.columns} onChange={(e) => setSection(i, { columns: Number(e.target.value) as 1 | 2 | 3 })}>
              <option value={1}>1 col</option>
              <option value={2}>2 cols</option>
              <option value={3}>3 cols</option>
            </NativeSelect>
            <Switch checked={sec.visible} onCheckedChange={(v) => setSection(i, { visible: v })} label={`Show ${sec.title}`} />
            <Button variant="ghost" size="icon" className="size-8" aria-label="Move section up" onClick={() => setSections(move(config.sections, i, i - 1))}>
              <ArrowUp />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Move section down" onClick={() => setSections(move(config.sections, i, i + 1))}>
              <ArrowDown />
            </Button>
          </div>
          {sec.visible && <SectionFields section={sec} onChange={(fields) => setSection(i, { fields })} />}
        </div>
      ))}
    </div>
  );
}

function SectionFields({ section, onChange }: { section: SectionConfig; onChange: (f: FieldSlot[]) => void }) {
  const [drag, setDrag] = useState<number | null>(null);
  const [adding, setAdding] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const isAuth = section.id === "auth";
  const fields = section.fields;
  const setField = (i: number, patch: Partial<FieldSlot>) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const used = new Set(fields.map((f) => f.key));
  const options = isAuth ? AUTH_FIELDS.filter((a) => !used.has(a.key)) : STANDARD_FIELDS.filter((f) => !used.has(f.key) && !["photo", "signature", "qr_data"].includes(f.key));

  return (
    <div className="flex flex-col gap-1.5 p-2">
      {fields.map((f, i) => (
        <div
          key={f.key}
          onDragOver={(e) => {
            if (drag !== null) e.preventDefault();
          }}
          onDrop={(e) => {
            e.stopPropagation();
            if (drag !== null) onChange(move(fields, drag, i));
            setDrag(null);
          }}
          className={cn("flex flex-wrap items-center gap-1.5 rounded-md border border-transparent px-1 py-1 hover:border-border", drag === i && "opacity-40", !f.visible && "opacity-60")}
        >
          <span draggable onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)} className="cursor-grab text-muted-foreground" aria-hidden>
            <GripVertical className="size-4" />
          </span>
          <Input className="h-8 min-w-28 flex-1" aria-label={`Label for ${f.key}`} value={f.label} onChange={(e) => setField(i, { label: e.target.value })} />
          <code className="hidden w-28 truncate text-[10px] text-muted-foreground xl:block" title={f.key}>
            {f.key}
          </code>
          {!isAuth && (
            <>
              <NativeSelect className="h-8 w-[74px] px-1.5 text-xs" aria-label="Width" value={f.span} onChange={(e) => setField(i, { span: Number(e.target.value) as 1 | 2 | 3 })}>
                <option value={1}>1 col</option>
                <option value={2}>2 col</option>
                <option value={3}>Full</option>
              </NativeSelect>
              <NativeSelect className="h-8 w-[76px] px-1.5 text-xs" aria-label="Alignment" value={f.align} onChange={(e) => setField(i, { align: e.target.value as FieldSlot["align"] })}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </NativeSelect>
              <Button
                variant={f.bold ? "secondary" : "ghost"}
                size="icon"
                className="size-8 font-extrabold"
                aria-pressed={!!f.bold}
                aria-label="Bold value"
                onClick={() => setField(i, { bold: !f.bold })}
              >
                B
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="size-8" aria-label={f.visible ? "Hide field" : "Show field"} onClick={() => setField(i, { visible: !f.visible })}>
            {f.visible ? <Eye /> : <EyeOff />}
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Move up" onClick={() => onChange(move(fields, i, i - 1))}>
            <ArrowUp />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Move down" onClick={() => onChange(move(fields, i, i + 1))}>
            <ArrowDown />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-danger" aria-label="Remove field" onClick={() => onChange(fields.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-dashed border-border pt-2">
        <NativeSelect className="h-8 w-52 text-xs" aria-label="Add field" value={adding} onChange={(e) => setAdding(e.target.value)}>
          <option value="">Add a field…</option>
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
          {!isAuth && <option value="__custom">Custom field (from CSV)…</option>}
        </NativeSelect>
        {adding === "__custom" && (
          <Input className="h-8 w-44 text-xs" placeholder="Custom field label" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} aria-label="Custom field label" />
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={!adding || (adding === "__custom" && !customLabel.trim())}
          onClick={() => {
            if (adding === "__custom") {
              const key = slugKey(customLabel);
              if (!used.has(key)) onChange([...fields, { key, label: customLabel.trim(), visible: true, span: 1, align: "left" }]);
              setCustomLabel("");
            } else {
              const label = [...STANDARD_FIELDS, ...AUTH_FIELDS].find((o) => o.key === adding)?.label ?? adding;
              onChange([...fields, { key: adding, label, visible: true, span: 1, align: "left" }]);
            }
            setAdding("");
          }}
        >
          <Plus /> Add
        </Button>
        {adding === "__custom" && customLabel && <span className="text-[11px] text-muted-foreground">key: {slugKey(customLabel)} — must match the custom field key used in mapping</span>}
      </div>
    </div>
  );
}
