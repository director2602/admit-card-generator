"use client";
import { useEffect, useState } from "react";
import { ArrowRight, LayoutTemplate, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TemplateEditor, type EditableTemplate } from "@/components/templates/template-editor";
import { cn, jsonFetch } from "@/lib/utils";
import type { TemplateSummary, WizardBatch } from "./types";

export function TemplateStep({ batch, templates: initial, onApplied, onBack }: { batch: WizardBatch; templates: TemplateSummary[]; onApplied: () => void; onBack: () => void }) {
  const [templates, setTemplates] = useState(initial);
  const [selected, setSelected] = useState<string>(batch.templateId ?? initial.find((t) => t.layout === "panel")?.id ?? initial[0]?.id ?? "");
  const [full, setFull] = useState<EditableTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selected) return;
    jsonFetch<{ template: EditableTemplate }>(`/api/templates/${selected}`)
      .then((d) => setFull(d.template))
      .catch((e) => toast.error(e.message));
  }, [selected]);

  async function apply() {
    setBusy(true);
    try {
      const r = await jsonFetch<{ changed: boolean }>(`/api/batches/${batch.id}/template`, { method: "POST", json: { templateId: selected } });
      if (r.changed) toast.success("Template applied to this batch");
      onApplied();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  async function createNew() {
    try {
      const { template } = await jsonFetch<{ template: EditableTemplate & { config: { layout: string } } }>("/api/templates", {
        method: "POST",
        json: { name: `${batch.name} template`, preset: "classic" },
      });
      setTemplates((t) => [...t, { id: template.id, name: template.name, layout: template.config.layout, updatedAt: new Date().toISOString() }]);
      setSelected(template.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Step 4 · Template & branding</CardTitle>
          <CardDescription>Choose a design, then adjust logo, colours, fields and layout. Changes are saved to the template and applied to this batch.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              aria-pressed={selected === t.id}
              className={cn(
                "flex min-w-52 cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted",
                selected === t.id ? "border-brand ring-1 ring-brand" : "border-border",
              )}
            >
              <span className="flex size-9 items-center justify-center rounded-md bg-brand-soft text-brand">
                <LayoutTemplate className="size-4" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.layout === "panel" ? "Three-panel" : "Classic"}</span>
              </span>
            </button>
          ))}
          <Button variant="outline" className="h-auto min-h-[62px]" onClick={createNew}>
            <Plus /> New template
          </Button>
        </CardContent>
      </Card>

      {full && full.id === selected ? (
        <TemplateEditor
          key={full.id}
          template={full}
          batchId={batch.id}
          onSaved={(t) => setTemplates((ts) => ts.map((x) => (x.id === t.id ? { ...x, name: t.name, layout: t.config.layout } : x)))}
        />
      ) : (
        <Skeleton className="h-[600px] w-full" />
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button size="lg" onClick={apply} disabled={!selected || busy}>
          {busy ? "Applying…" : "Use this template & preview"} <ArrowRight />
        </Button>
      </div>
      <p className="text-right text-xs text-muted-foreground">Unsaved edits are not applied — click “Save template” first.</p>
    </div>
  );
}
