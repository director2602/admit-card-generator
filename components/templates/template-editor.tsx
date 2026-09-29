"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, RotateCcw, Save, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { PreviewFrame } from "@/components/preview-frame";
import { AssetPicker } from "./asset-picker";
import { FieldsEditor } from "./fields-editor";
import { FONT_OPTIONS, type TemplateConfig } from "@/lib/template/types";
import { defaultTemplate, sathiiTemplate, PAPER_SIZES, cardDims } from "@/lib/template/defaults";
import { jsonFetch } from "@/lib/utils";

export interface EditableTemplate {
  id: string;
  name: string;
  config: TemplateConfig;
}

function Num({ label, value, onChange, min, max, step = 1, unit }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; step?: number; unit?: string }) {
  const id = `n-${label.replace(/\W+/g, "-")}`;
  return (
    <Field label={unit ? `${label} (${unit})` : label} htmlFor={id}>
      <Input
        id={id}
        type="number"
        className="h-9"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </Field>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = `c-${label.replace(/\W+/g, "-")}`;
  return (
    <Field label={label} htmlFor={id}>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} picker`} value={value.length === 7 ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-9 w-10 cursor-pointer rounded border border-input bg-card p-0.5" />
        <Input
          id={id}
          className="h-9 font-mono text-xs"
          value={value}
          maxLength={9}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (/^#[0-9a-fA-F]{0,8}$/.test(v)) onChange(v);
          }}
        />
      </div>
    </Field>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm font-semibold">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} label={label} />
    </label>
  );
}

export function TemplateEditor({
  template,
  onSaved,
  batchId,
  saveLabel = "Save template",
}: {
  template: EditableTemplate;
  onSaved?: (t: EditableTemplate) => void;
  /** When editing inside a batch, preview with that batch's first candidate. */
  batchId?: string;
  saveLabel?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [c, setC] = useState<TemplateConfig>(template.config);
  const [saved, setSaved] = useState(JSON.stringify({ n: template.name, c: template.config }));
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"sample" | "batch">(batchId ? "batch" : "sample");
  const dirty = JSON.stringify({ n: name, c }) !== saved;

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const b = c.branding;
  const setB = (p: Partial<TemplateConfig["branding"]>) => setC((x) => ({ ...x, branding: { ...x.branding, ...p } }));
  const setPage = (p: Partial<TemplateConfig["page"]>) => setC((x) => ({ ...x, page: { ...x.page, ...p } }));
  const setHeader = (p: Partial<TemplateConfig["header"]>) => setC((x) => ({ ...x, header: { ...x.header, ...p } }));
  const setPhoto = (p: Partial<TemplateConfig["photo"]>) => setC((x) => ({ ...x, photo: { ...x.photo, ...p } }));
  const setCode = (p: Partial<TemplateConfig["code"]>) => setC((x) => ({ ...x, code: { ...x.code, ...p } }));
  const setIns = (p: Partial<TemplateConfig["instructions"]>) => setC((x) => ({ ...x, instructions: { ...x.instructions, ...p } }));
  const setPanel = (p: Partial<TemplateConfig["panel"]>) => setC((x) => ({ ...x, panel: { ...x.panel, ...p } }));

  async function save() {
    setSaving(true);
    try {
      const { template: t } = await jsonFetch<{ template: EditableTemplate }>(`/api/templates/${template.id}`, { method: "PATCH", json: { name, config: c } });
      setSaved(JSON.stringify({ n: t.name, c: t.config }));
      toast.success("Template saved");
      onSaved?.(t);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function duplicate() {
    try {
      const { template: t } = await jsonFetch<{ template: EditableTemplate }>(`/api/templates/${template.id}/duplicate`, { method: "POST" });
      toast.success("Template duplicated");
      router.push(`/templates/${t.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const presetSize = (preset: "A4" | "Letter" | "custom", orientation = c.page.orientation) => {
    if (preset === "custom") return setPage({ preset });
    const p = PAPER_SIZES[preset];
    setPage({ preset, orientation, widthMm: orientation === "landscape" ? p.h : p.w, heightMm: orientation === "landscape" ? p.w : p.h });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          <Input aria-label="Template name" className="h-10 max-w-sm flex-1 font-semibold" value={name} onChange={(e) => setName(e.target.value)} />
          <span className="text-xs font-medium text-muted-foreground" aria-live="polite">
            {dirty ? "Unsaved changes" : (
              <span className="inline-flex items-center gap-1 text-success">
                <Check className="size-3.5" aria-hidden /> Saved
              </span>
            )}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <RotateCcw /> Reset
                </Button>
              </DialogTrigger>
              <DialogContent title="Reset to a default design?" description="This replaces the current design in the editor. Nothing is saved until you click Save.">
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => setC(defaultTemplate())}>
                    Classic A4 default
                  </Button>
                  <Button variant="outline" onClick={() => setC(sathiiTemplate())}>
                    SATHII three-panel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={duplicate}>
              <Copy /> Duplicate
            </Button>
            <Button size="sm" onClick={save} disabled={saving || (!dirty && !onSaved)}>
              <Save /> {saving ? "Saving…" : saveLabel}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[440px_1fr] [&>*]:min-w-0">
        <Card className="h-fit">
          <CardContent className="p-4">
            <Tabs defaultValue="branding">
              <TabsList>
                <TabsTrigger value="branding">Branding</TabsTrigger>
                <TabsTrigger value="layout">Page</TabsTrigger>
                <TabsTrigger value="fields">Fields</TabsTrigger>
                <TabsTrigger value="photo">Photo & QR</TabsTrigger>
                <TabsTrigger value="auth">Signatures</TabsTrigger>
                <TabsTrigger value="ins">Instructions</TabsTrigger>
                <TabsTrigger value="out">Output</TabsTrigger>
              </TabsList>

              <TabsContent value="branding" className="flex flex-col gap-4">
                <Field label="Design" htmlFor="layout">
                  <NativeSelect id="layout" value={c.layout} onChange={(e) => setC((x) => ({ ...x, layout: e.target.value as TemplateConfig["layout"] }))}>
                    <option value="classic">Classic — header, details, signatures, instructions</option>
                    <option value="panel">Three-panel — logos left & right, details centre (SATHII style)</option>
                  </NativeSelect>
                </Field>
                <Field label="Organisation name" htmlFor="org">
                  <Input id="org" value={b.orgName} onChange={(e) => setB({ orgName: e.target.value })} />
                </Field>
                <Field label="Subtitle / examination authority" htmlFor="sub">
                  <Input id="sub" value={b.subtitle} onChange={(e) => setB({ subtitle: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Card title" htmlFor="title">
                    <Input id="title" value={c.header.title} onChange={(e) => setHeader({ title: e.target.value })} />
                  </Field>
                  <Field label="Title suffix" htmlFor="subtitle">
                    <Input id="subtitle" value={c.header.subtitle} onChange={(e) => setHeader({ subtitle: e.target.value })} placeholder="HALL TICKET" />
                  </Field>
                </div>
                {c.layout === "classic" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Exam line" htmlFor="examLine" hint="Tokens like {{exam_name}} work.">
                      <Input id="examLine" value={c.header.examLine} onChange={(e) => setHeader({ examLine: e.target.value })} />
                    </Field>
                    <Field label="Session line" htmlFor="sess">
                      <Input id="sess" value={c.header.sessionLine} onChange={(e) => setHeader({ sessionLine: e.target.value })} />
                    </Field>
                  </div>
                )}
                <AssetPicker label="Organisation logo" kind="logo" value={b.logo} onChange={(v) => setB({ logo: v })} hint="PNG, JPEG or WebP up to 2 MB. Transparent PNG works best." />
                <AssetPicker label={c.layout === "panel" ? "Right panel logo" : "Secondary logo (optional)"} kind="logo" value={b.secondaryLogo} onChange={(v) => setB({ secondaryLogo: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <ColorInput label="Primary" value={b.primary} onChange={(v) => setB({ primary: v })} />
                  <ColorInput label={c.layout === "panel" ? "Centre panel" : "Secondary"} value={b.secondary} onChange={(v) => setB({ secondary: v })} />
                  <ColorInput label="Accent" value={b.accent} onChange={(v) => setB({ accent: v })} />
                  <ColorInput label="Text" value={b.text} onChange={(v) => setB({ text: v })} />
                  <ColorInput label="Panel background" value={b.panelBackground} onChange={(v) => setB({ panelBackground: v })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Font" htmlFor="font">
                    <NativeSelect id="font" className="h-9" value={b.fontFamily} onChange={(e) => setB({ fontFamily: e.target.value as TemplateConfig["branding"]["fontFamily"] })}>
                      {FONT_OPTIONS.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Num label="Base size" unit="pt" value={b.baseFontPt} min={6} max={16} step={0.5} onChange={(n) => setB({ baseFontPt: n })} />
                  {c.layout === "classic" && (
                    <Field label="Header style" htmlFor="hs">
                      <NativeSelect id="hs" className="h-9" value={b.headerStyle} onChange={(e) => setB({ headerStyle: e.target.value as TemplateConfig["branding"]["headerStyle"] })}>
                        <option value="solid">Solid colour band</option>
                        <option value="light">Light tint</option>
                        <option value="minimal">Minimal line</option>
                      </NativeSelect>
                    </Field>
                  )}
                  <Field label="Border" htmlFor="border">
                    <NativeSelect id="border" className="h-9" value={b.border} onChange={(e) => setB({ border: e.target.value as TemplateConfig["branding"]["border"] })}>
                      <option value="none">None</option>
                      <option value="single">Single</option>
                      <option value="double">Double</option>
                      <option value="dashed">Dashed</option>
                    </NativeSelect>
                  </Field>
                  <Num label="Border width" unit="pt" value={b.borderWidthPt} min={0} max={6} step={0.25} onChange={(n) => setB({ borderWidthPt: n })} />
                  <Num label="Corner radius" unit="mm" value={b.cornerRadiusMm} min={0} max={10} step={0.5} onChange={(n) => setB({ cornerRadiusMm: n })} />
                </div>
                <AssetPicker label="Watermark image" kind="watermark" value={b.watermark} onChange={(v) => setB({ watermark: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="…or watermark text" htmlFor="wmt">
                    <Input id="wmt" value={b.watermarkText} onChange={(e) => setB({ watermarkText: e.target.value })} placeholder="e.g. ORIGINAL" />
                  </Field>
                  <Num label="Watermark opacity" value={b.watermarkOpacity} min={0} max={0.5} step={0.01} onChange={(n) => setB({ watermarkOpacity: n })} />
                </div>
                <AssetPicker label="Background image" kind="background" value={b.backgroundImage} onChange={(v) => setB({ backgroundImage: v })} hint="Covers the whole card. Keep it light so text stays readable." />
              </TabsContent>

              <TabsContent value="layout" className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Paper" htmlFor="paper">
                    <NativeSelect id="paper" className="h-9" value={c.page.preset} onChange={(e) => presetSize(e.target.value as "A4")}>
                      <option value="A4">A4</option>
                      <option value="Letter">US Letter</option>
                      <option value="custom">Custom size</option>
                    </NativeSelect>
                  </Field>
                  {c.page.preset !== "custom" ? (
                    <Field label="Orientation" htmlFor="orient">
                      <NativeSelect id="orient" className="h-9" value={c.page.orientation} onChange={(e) => presetSize(c.page.preset, e.target.value as "portrait")}>
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                      </NativeSelect>
                    </Field>
                  ) : (
                    <div />
                  )}
                  {c.page.preset === "custom" && (
                    <>
                      <Num label="Width" unit="mm" value={c.page.widthMm} min={50} max={600} onChange={(n) => setPage({ widthMm: n })} />
                      <Num label="Height" unit="mm" value={c.page.heightMm} min={40} max={900} onChange={(n) => setPage({ heightMm: n })} />
                    </>
                  )}
                  <Num label="Margin" unit="mm" value={c.page.marginMm} min={0} max={40} step={0.5} onChange={(n) => setPage({ marginMm: n })} />
                  <Field label="Cards per page" htmlFor="cpp" hint="Applies to the combined PDF. Individual PDFs always hold one card.">
                    <NativeSelect id="cpp" className="h-9" value={c.page.cardsPerPage} onChange={(e) => setPage({ cardsPerPage: Number(e.target.value) as 1 })}>
                      {[1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  {c.page.cardsPerPage > 1 && <Num label="Gap between cards" unit="mm" value={c.page.gapMm} min={0} max={40} onChange={(n) => setPage({ gapMm: n })} />}
                </div>
                {(() => {
                  const d = cardDims(c);
                  const minH = c.layout === "panel" ? 85 : 190;
                  return (
                    <p className={d.h < minH ? "rounded-md bg-warning-soft px-3 py-2 text-xs font-medium text-warning" : "text-xs text-muted-foreground"}>
                      Each card: {d.w.toFixed(0)} × {d.h.toFixed(0)} mm.
                      {d.h < minH &&
                        ` This design needs roughly ${minH} mm of height — content may be cut off. Use fewer cards per page, a taller page, or hide sections.`}
                    </p>
                  );
                })()}
                {c.layout === "panel" && (
                  <>
                    <Field label="Left panel tagline" htmlFor="tag">
                      <Textarea id="tag" rows={2} value={c.panel.leftTagline} onChange={(e) => setPanel({ leftTagline: e.target.value })} />
                    </Field>
                    <Field label="Contact heading" htmlFor="ct">
                      <Input id="ct" value={c.panel.contactTitle} onChange={(e) => setPanel({ contactTitle: e.target.value })} />
                    </Field>
                    <Field label="Contact lines" htmlFor="cl" hint="One per line; an empty line adds spacing.">
                      <Textarea id="cl" rows={7} value={c.panel.contactLines.join("\n")} onChange={(e) => setPanel({ contactLines: e.target.value.split("\n").slice(0, 20) })} />
                    </Field>
                    <Field label="Footer note" htmlFor="fn" hint="Wrap text in **double asterisks** for bold.">
                      <Textarea id="fn" rows={2} value={c.panel.footerNote} onChange={(e) => setPanel({ footerNote: e.target.value })} />
                    </Field>
                    <Toggle label="Candidate signature box" checked={c.panel.showCandidateSignatureBox} onChange={(v) => setPanel({ showCandidateSignatureBox: v })} />
                  </>
                )}
              </TabsContent>

              <TabsContent value="fields">
                <FieldsEditor config={c} onChange={setC} />
              </TabsContent>

              <TabsContent value="photo" className="flex flex-col gap-4">
                <Toggle label="Show candidate photograph" checked={c.photo.enabled} onChange={(v) => setPhoto({ enabled: v })} />
                {c.photo.enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <Num label="Photo width" unit="mm" value={c.photo.widthMm} min={15} max={80} onChange={(n) => setPhoto({ widthMm: n })} />
                    <Num label="Photo height" unit="mm" value={c.photo.heightMm} min={15} max={100} onChange={(n) => setPhoto({ heightMm: n })} />
                    {c.layout === "classic" && (
                      <Field label="Position" htmlFor="pp">
                        <NativeSelect id="pp" className="h-9" value={c.photo.position} onChange={(e) => setPhoto({ position: e.target.value as "left" })}>
                          <option value="right">Right</option>
                          <option value="left">Left</option>
                        </NativeSelect>
                      </Field>
                    )}
                    <Toggle label="Rounded corners" checked={c.photo.rounded} onChange={(v) => setPhoto({ rounded: v })} />
                    <Field label="Text when no photo" htmlFor="ph" className="col-span-2">
                      <Input id="ph" value={c.photo.placeholderText} onChange={(e) => setPhoto({ placeholderText: e.target.value })} />
                    </Field>
                  </div>
                )}
                <Toggle label="Show QR code / barcode" checked={c.code.enabled} onChange={(v) => setCode({ enabled: v })} />
                {c.code.enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Type" htmlFor="ck">
                      <NativeSelect id="ck" className="h-9" value={c.code.kind} onChange={(e) => setCode({ kind: e.target.value as "qr" })}>
                        <option value="qr">QR code</option>
                        <option value="barcode">Barcode (Code 128)</option>
                      </NativeSelect>
                    </Field>
                    <Num label="Size" unit="mm" value={c.code.sizeMm} min={10} max={60} onChange={(n) => setCode({ sizeMm: n })} />
                    <Field label="Encoded data" htmlFor="cd" className="col-span-2" hint="Use {{field}} tokens. A mapped “QR Code Data” column overrides this.">
                      <Input id="cd" value={c.code.data} onChange={(e) => setCode({ data: e.target.value })} />
                    </Field>
                    <Field label="Caption" htmlFor="cc" className="col-span-2">
                      <Input id="cc" value={c.code.label} onChange={(e) => setCode({ label: e.target.value })} />
                    </Field>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="auth" className="flex flex-col gap-4">
                <p className="text-xs text-muted-foreground">Signature boxes are configured in the Fields tab (Authentication section). Upload the authority signature and seal here.</p>
                <AssetPicker label="Authorised signature image" kind="signature" value={b.signatureImage} onChange={(v) => setB({ signatureImage: v })} />
                <AssetPicker label="Stamp / seal" kind="stamp" value={b.stamp} onChange={(v) => setB({ stamp: v })} />
                <Field label="Signatory name" htmlFor="sn">
                  <Input id="sn" value={b.signatoryName} onChange={(e) => setB({ signatoryName: e.target.value })} />
                </Field>
                <Field label="Signatory designation" htmlFor="sd">
                  <Input id="sd" value={b.signatoryDesignation} onChange={(e) => setB({ signatoryDesignation: e.target.value })} />
                </Field>
              </TabsContent>

              <TabsContent value="ins" className="flex flex-col gap-4">
                <Toggle label="Include instructions" checked={c.instructions.enabled} onChange={(v) => setIns({ enabled: v })} />
                {c.instructions.enabled && (
                  <>
                    <Field label="Placement" htmlFor="ipl">
                      <NativeSelect id="ipl" className="h-9" value={c.instructions.placement} onChange={(e) => setIns({ placement: e.target.value as "front" })}>
                        <option value="front">Front of the card</option>
                        <option value="back">Separate back page</option>
                      </NativeSelect>
                    </Field>
                    <Field label="Heading" htmlFor="it">
                      <Input id="it" value={c.instructions.title} onChange={(e) => setIns({ title: e.target.value })} />
                    </Field>
                    <Field label="Instructions" htmlFor="ii" hint="One instruction per line (reporting rules, ID documents, prohibited items…).">
                      <Textarea id="ii" rows={9} value={c.instructions.items.join("\n")} onChange={(e) => setIns({ items: e.target.value.split("\n").slice(0, 30) })} />
                    </Field>
                    <Field label="Candidate acknowledgement" htmlFor="ack" hint="Leave empty to hide.">
                      <Textarea id="ack" rows={2} value={c.instructions.acknowledgement} onChange={(e) => setIns({ acknowledgement: e.target.value })} />
                    </Field>
                  </>
                )}
              </TabsContent>

              <TabsContent value="out" className="flex flex-col gap-4">
                <Field label="PDF file name pattern" htmlFor="fnp" hint="Tokens: {{roll_number}}, {{application_number}}, {{candidate_name}} or any custom field. Unsafe characters are replaced.">
                  <Input id="fnp" value={c.filenamePattern} onChange={(e) => setC((x) => ({ ...x, filenamePattern: e.target.value }))} />
                </Field>
                <Field label="Date format" htmlFor="df">
                  <NativeSelect id="df" className="h-9" value={c.dateFormat} onChange={(e) => setC((x) => ({ ...x, dateFormat: e.target.value as TemplateConfig["dateFormat"] }))}>
                    <option value="DD-MM-YYYY">15-11-2026</option>
                    <option value="DD/MM/YYYY">15/11/2026</option>
                    <option value="D MMM YYYY">15 Nov 2026</option>
                    <option value="YYYY-MM-DD">2026-11-15</option>
                  </NativeSelect>
                </Field>
                {c.layout === "classic" && <Toggle label="Show application & roll number in title bar" checked={c.header.showIds} onChange={(v) => setHeader({ showIds: v })} />}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold">Live preview</div>
                  <div className="text-xs text-muted-foreground">Rendered by the same engine as the PDFs. {previewMode === "sample" ? "Sample data is fictional." : "Using this batch’s first candidate."}</div>
                </div>
                {batchId && (
                  <NativeSelect aria-label="Preview data" className="h-8 w-44 text-xs" value={previewMode} onChange={(e) => setPreviewMode(e.target.value as "sample")}>
                    <option value="batch">Batch candidate</option>
                    <option value="sample">Sample candidate</option>
                  </NativeSelect>
                )}
              </div>
              <div className="rounded-md bg-[#e9ebf2] p-3">
                <PreviewFrame template={c} batchId={previewMode === "batch" ? batchId : undefined} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
