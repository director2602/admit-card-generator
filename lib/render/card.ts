/**
 * Pure HTML renderer for admit cards. The same markup powers the live preview,
 * the print view and Puppeteer PDF output, so what users see is what they print.
 * All user-provided text is HTML-escaped here; image sources and the code SVG
 * are produced by trusted server code.
 */
import { escapeHtml, fillTokens } from "@/lib/security/sanitize";
import type { FieldSlot, SectionConfig, TemplateConfig } from "@/lib/template/types";
import { FONT_OPTIONS } from "@/lib/template/types";
import { cardDims, pageDims } from "@/lib/template/defaults";
import { displayData } from "./format";

export interface CardImages {
  logo?: string | null;
  secondaryLogo?: string | null;
  watermark?: string | null;
  backgroundImage?: string | null;
  signatureImage?: string | null;
  stamp?: string | null;
  photo?: string | null;
  candidateSignature?: string | null;
}

export interface CardContext {
  images: CardImages;
  /** Trusted SVG markup for the QR code / barcode (generated server-side). */
  codeSvg?: string | null;
  customFields?: { key: string; label: string }[];
}

export interface RenderedCard {
  front: string;
  back: string | null;
}

const e = escapeHtml;
const img = (src: string | null | undefined, cls: string, alt: string) =>
  src ? `<img class="${cls}" src="${e(src)}" alt="${e(alt)}">` : "";

/** Very small markup: **bold** only, after escaping. */
function richText(s: string): string {
  return e(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function multiline(s: string): string {
  return s
    .split("\n")
    .map((l) => e(l))
    .join("<br>");
}

const AUTH_KEYS = new Set(["sig_candidate", "sig_invigilator", "sig_authority"]);

function placedKeys(t: TemplateConfig): Set<string> {
  const s = new Set<string>();
  for (const sec of t.sections) for (const f of sec.fields) s.add(f.key);
  return s;
}

/** Custom fields that the template does not place explicitly are appended to the candidate section. */
function withUnplacedCustom(sec: SectionConfig, t: TemplateConfig, ctx: CardContext): FieldSlot[] {
  if (sec.id !== "candidate") return sec.fields;
  const placed = placedKeys(t);
  const extra: FieldSlot[] = (ctx.customFields ?? [])
    .filter((c) => !placed.has(c.key))
    .map((c) => ({ key: c.key, label: c.label, visible: true, span: 1, align: "left" }));
  return [...sec.fields, ...extra];
}

function fieldCell(f: FieldSlot, value: string, columns: number): string {
  const span = Math.min(f.span, columns);
  return `<div class="ac-f" style="grid-column: span ${span}; text-align:${f.align}">
<div class="ac-fl">${e(f.label)}</div><div class="ac-fv${f.bold ? " ac-b" : ""}">${e(value)}</div></div>`;
}

function renderSection(sec: SectionConfig, t: TemplateConfig, d: Record<string, string>, ctx: CardContext): string {
  const cells = withUnplacedCustom(sec, t, ctx)
    .filter((f) => f.visible && !AUTH_KEYS.has(f.key) && d[f.key])
    .map((f) => fieldCell(f, d[f.key], sec.columns));
  if (!cells.length) return "";
  return `<section class="ac-sec"><h3 class="ac-st">${e(sec.title)}</h3>
<div class="ac-grid" style="grid-template-columns: repeat(${sec.columns}, minmax(0,1fr))">${cells.join("")}</div></section>`;
}

function photoBox(t: TemplateConfig, ctx: CardContext): string {
  if (!t.photo.enabled) return "";
  const inner = ctx.images.photo
    ? `<img src="${e(ctx.images.photo)}" alt="Candidate photograph">`
    : `<span>${e(t.photo.placeholderText)}</span>`;
  return `<div class="ac-photo${t.photo.rounded ? " ac-round" : ""}" style="width:${t.photo.widthMm}mm;height:${t.photo.heightMm}mm">${inner}</div>`;
}

function codeBlock(t: TemplateConfig, ctx: CardContext): string {
  if (!t.code.enabled || !ctx.codeSvg) return "";
  const w = t.code.kind === "qr" ? t.code.sizeMm : t.code.sizeMm * 2.2;
  return `<div class="ac-code"><div class="ac-code-svg" style="width:${w}mm;height:${t.code.sizeMm}mm">${ctx.codeSvg}</div>${
    t.code.label ? `<div class="ac-code-l">${e(t.code.label)}</div>` : ""
  }</div>`;
}

function authSection(sec: SectionConfig, t: TemplateConfig, ctx: CardContext): string {
  const b = t.branding;
  const cells = sec.fields
    .filter((f) => f.visible)
    .map((f) => {
      if (f.key === "sig_candidate") {
        return `<div class="ac-sig"><div class="ac-sig-area">${img(ctx.images.candidateSignature, "ac-sig-img", "Candidate signature")}</div><div class="ac-sig-l">${e(f.label)}</div></div>`;
      }
      if (f.key === "sig_invigilator") {
        return `<div class="ac-sig"><div class="ac-sig-area"></div><div class="ac-sig-l">${e(f.label)}</div></div>`;
      }
      if (f.key === "sig_authority") {
        const name = b.signatoryName ? `<div class="ac-sig-n">${e(b.signatoryName)}</div>` : "";
        const des = b.signatoryDesignation ? `<div class="ac-sig-d">${e(b.signatoryDesignation)}</div>` : "";
        return `<div class="ac-sig"><div class="ac-sig-area">${img(ctx.images.stamp, "ac-stamp", "Seal")}${img(ctx.images.signatureImage, "ac-sig-img", "Authorised signature")}</div><div class="ac-sig-l">${e(f.label)}</div>${name}${des}</div>`;
      }
      return "";
    })
    .filter(Boolean);
  if (!cells.length) return "";
  return `<section class="ac-auth" style="grid-template-columns: repeat(${cells.length}, minmax(0,1fr))">${cells.join("")}</section>`;
}

function instructionsBlock(t: TemplateConfig, cls = "ac-ins"): string {
  const i = t.instructions;
  if (!i.enabled || !i.items.filter((x) => x.trim()).length) return "";
  const items = i.items.filter((x) => x.trim()).map((x) => `<li>${richText(x)}</li>`).join("");
  const ack = i.acknowledgement
    ? `<div class="ac-ack"><p>${e(i.acknowledgement)}</p><div class="ac-ack-sig"><span></span>Candidate's Signature</div></div>`
    : "";
  return `<section class="${cls}"><h3 class="ac-it">${e(i.title)}</h3><ol>${items}</ol>${ack}</section>`;
}

function decorations(t: TemplateConfig, ctx: CardContext): string {
  const parts: string[] = [];
  if (ctx.images.backgroundImage) parts.push(`<img class="ac-bg" src="${e(ctx.images.backgroundImage)}" alt="">`);
  if (ctx.images.watermark)
    parts.push(`<img class="ac-wm" style="opacity:${t.branding.watermarkOpacity}" src="${e(ctx.images.watermark)}" alt="">`);
  else if (t.branding.watermarkText)
    parts.push(`<div class="ac-wmt" style="opacity:${t.branding.watermarkOpacity}">${e(t.branding.watermarkText)}</div>`);
  return parts.join("");
}

function renderClassic(t: TemplateConfig, d: Record<string, string>, ctx: CardContext): RenderedCard {
  const b = t.branding;
  const exam = fillTokens(t.header.examLine, d);
  const session = fillTokens(t.header.sessionLine, d);
  const ids: string[] = [];
  if (t.header.showIds) {
    if (d.application_number) ids.push(`Application No: <b>${e(d.application_number)}</b>`);
    if (d.roll_number) ids.push(`Roll No: <b>${e(d.roll_number)}</b>`);
  }
  const content = t.sections.filter((s) => s.visible && s.id !== "auth");
  const auth = t.sections.find((s) => s.id === "auth" && s.visible);
  const [first, ...rest] = content;
  const firstHtml = first ? renderSection(first, t, d, ctx) : "";
  const side = `${photoBox(t, ctx)}${codeBlock(t, ctx)}`;
  const topRow = side
    ? `<div class="ac-row ${t.photo.position === "left" ? "ac-row-rev" : ""}"><div class="ac-main">${firstHtml}</div><div class="ac-side">${side}</div></div>`
    : firstHtml;
  const front = `<div class="ac-card ac-classic ac-h-${b.headerStyle}">${decorations(t, ctx)}
<header class="ac-head">
  <div class="ac-logo">${img(ctx.images.logo, "", "Logo")}</div>
  <div class="ac-org"><div class="ac-on">${e(b.orgName)}</div>${b.subtitle ? `<div class="ac-os">${e(b.subtitle)}</div>` : ""}${
    exam ? `<div class="ac-ex">${e(exam)}</div>` : ""
  }${session ? `<div class="ac-se">${e(session)}</div>` : ""}</div>
  <div class="ac-logo">${img(ctx.images.secondaryLogo, "", "Logo")}</div>
</header>
<div class="ac-title"><div class="ac-tt">${e(t.header.title)}${t.header.subtitle ? ` <span>/ ${e(t.header.subtitle)}</span>` : ""}</div>${
    ids.length ? `<div class="ac-ids">${ids.join('<i class="ac-dot"></i>')}</div>` : ""
  }</div>
<div class="ac-body">${topRow}${rest.map((s) => renderSection(s, t, d, ctx)).join("")}${auth ? authSection(auth, t, ctx) : ""}${
    t.instructions.placement === "front" ? instructionsBlock(t) : ""
  }</div>
</div>`;
  const back =
    t.instructions.enabled && t.instructions.placement === "back"
      ? `<div class="ac-card ac-classic ac-back">${decorations(t, ctx)}<div class="ac-back-h"><span>${e(b.orgName)}</span><span>${
          d.roll_number ? `Roll No: ${e(d.roll_number)}` : ""
        }</span></div>${instructionsBlock(t)}</div>`
      : null;
  return { front, back };
}

function renderPanel(t: TemplateConfig, d: Record<string, string>, ctx: CardContext): RenderedCard {
  const b = t.branding;
  const fields = t.sections
    .filter((s) => s.visible && s.id !== "auth")
    .flatMap((s) => withUnplacedCustom(s, t, ctx))
    .filter((f) => f.visible && !AUTH_KEYS.has(f.key) && d[f.key]);
  const grid = fields
    .map(
      (f) =>
        `<div class="pn-f" style="grid-column: span ${Math.min(f.span, 2)}; text-align:${f.align}"><span class="pn-l">${e(f.label)} :</span> <span class="pn-v${
          f.bold ? " ac-b" : ""
        }">${e(d[f.key])}</span></div>`,
    )
    .join("");
  const contact = t.panel.contactLines.map((l) => (l.trim() ? `<div>${e(l)}</div>` : `<div class="pn-gap"></div>`)).join("");
  const front = `<div class="ac-card ac-panelcard">${decorations(t, ctx)}
<aside class="pn-left">
  ${img(ctx.images.logo, "pn-logo", "Logo")}
  ${t.panel.leftTagline ? `<div class="pn-tag">${multiline(t.panel.leftTagline)}</div>` : ""}
  ${photoBox(t, ctx)}
  ${
    t.panel.showCandidateSignatureBox
      ? `<div class="pn-sigbox">${img(ctx.images.candidateSignature, "ac-sig-img", "Candidate signature")}</div><div class="pn-sigl">Signature of the candidate</div>`
      : ""
  }
</aside>
<main class="pn-center">
  <div class="pn-title">${e(t.header.title)}</div>
  <div class="pn-body">
    <div class="pn-grid">${grid}</div>
    ${t.instructions.placement === "front" ? instructionsBlock(t, "pn-ins") : ""}
  </div>
  ${t.panel.footerNote ? `<div class="pn-foot">${richText(t.panel.footerNote)}</div>` : ""}
</main>
<aside class="pn-right">
  ${img(ctx.images.secondaryLogo, "pn-logo2", "Logo")}
  <div class="pn-contact">${t.panel.contactTitle ? `<div class="pn-ct">${e(t.panel.contactTitle)}</div>` : ""}${contact}</div>
  ${codeBlock(t, ctx)}
  ${
    ctx.images.signatureImage || b.signatoryDesignation && t.sections.find((s) => s.id === "auth")?.visible
      ? `<div class="pn-auth">${img(ctx.images.signatureImage, "ac-sig-img", "Authorised signature")}<div class="ac-sig-d">${e(b.signatoryDesignation)}</div></div>`
      : ""
  }
</aside>
</div>`;
  const back =
    t.instructions.enabled && t.instructions.placement === "back"
      ? `<div class="ac-card ac-panelcard ac-back"><main class="pn-center" style="grid-column:1 / -1"><div class="pn-title">${e(
          t.instructions.title,
        )}</div><div class="pn-body">${instructionsBlock(t, "pn-ins")}</div></main></div>`
      : null;
  return { front, back };
}

export function renderCard(t: TemplateConfig, data: Record<string, string>, ctx: CardContext): RenderedCard {
  const d = displayData(data, t);
  return t.layout === "panel" ? renderPanel(t, d, ctx) : renderClassic(t, d, ctx);
}

export function fontStack(t: TemplateConfig): string {
  const f = FONT_OPTIONS.find((x) => x.key === t.branding.fontFamily) ?? FONT_OPTIONS[0];
  return `${f.css}, 'Noto Sans', 'Noto Sans Devanagari', 'DejaVu Sans', Arial, sans-serif`;
}

/** Card + page CSS. Units are physical (mm / pt) so print output matches the design exactly. */
export function cardCss(t: TemplateConfig): string {
  const b = t.branding;
  const { w: pw, h: ph } = pageDims(t);
  const { w: cw, h: ch } = cardDims(t);
  const border =
    b.border === "none" ? "none" : `${b.border === "double" ? Math.max(b.borderWidthPt, 2.5) : b.borderWidthPt}pt ${b.border} ${b.primary}`;
  return `
@page { size: ${pw}mm ${ph}mm; margin: 0; }
html, body { margin: 0; padding: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.ac-page { width: ${pw}mm; height: ${ph}mm; padding: ${t.page.marginMm}mm; box-sizing: border-box; display: flex; flex-direction: column; gap: ${t.page.gapMm}mm; overflow: hidden; page-break-after: always; break-after: page; background: #fff; }
.ac-page:last-child { page-break-after: auto; break-after: auto; }
.ac-slot { width: ${cw}mm; height: ${ch}mm; flex: none; }
.ac-card { position: relative; width: 100%; height: 100%; box-sizing: border-box; overflow: hidden; font-family: ${fontStack(t)}; font-size: ${b.baseFontPt}pt; line-height: 1.3; color: ${b.text}; background: #fff; border: ${border}; border-radius: ${b.cornerRadiusMm}mm; }
.ac-card * { box-sizing: border-box; }
.ac-card img { display: block; }
.ac-b { font-weight: 700; }
.ac-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
.ac-wm { position: absolute; left: 50%; top: 50%; width: 55%; max-height: 70%; object-fit: contain; transform: translate(-50%, -50%); z-index: 0; pointer-events: none; }
.ac-wmt { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%) rotate(-28deg); font-size: 5.2em; font-weight: 800; letter-spacing: .08em; white-space: nowrap; color: ${b.primary}; z-index: 0; }
.ac-card > *:not(.ac-bg):not(.ac-wm):not(.ac-wmt) { position: relative; z-index: 1; }

/* ---------- classic ---------- */
.ac-classic { display: flex; flex-direction: column; }
.ac-head { display: grid; grid-template-columns: 22mm 1fr 22mm; align-items: center; gap: 4mm; padding: 4mm 6mm; }
.ac-h-solid .ac-head { background: ${b.primary}; color: #fff; }
.ac-h-light .ac-head { background: ${b.panelBackground}; border-bottom: 1.5pt solid ${b.primary}; }
.ac-h-minimal .ac-head { border-bottom: 0.75pt solid ${b.primary}; }
.ac-logo { height: 20mm; display: flex; align-items: center; justify-content: center; }
.ac-logo img { max-width: 22mm; max-height: 20mm; object-fit: contain; }
.ac-h-solid .ac-logo img { background: #fff; border-radius: 1.5mm; padding: 1mm; }
.ac-org { text-align: center; }
.ac-on { font-size: 1.75em; font-weight: 800; letter-spacing: .01em; line-height: 1.15; }
.ac-os { font-size: 1em; opacity: .9; margin-top: .6mm; }
.ac-ex { font-size: 1.2em; font-weight: 700; margin-top: 1.2mm; }
.ac-h-solid .ac-ex { color: ${b.accent === b.primary ? "#fff" : lighten(b.accent)}; }
.ac-h-light .ac-ex, .ac-h-minimal .ac-ex { color: ${b.secondary}; }
.ac-se { font-size: .95em; opacity: .85; }
.ac-title { display: flex; align-items: center; justify-content: space-between; gap: 4mm; padding: 2.2mm 6mm; background: ${b.panelBackground}; border-bottom: 0.75pt solid ${b.secondary}33; }
.ac-tt { font-size: 1.45em; font-weight: 800; letter-spacing: .12em; color: ${b.primary}; }
.ac-tt span { color: ${b.accent}; font-weight: 700; letter-spacing: .08em; }
.ac-ids { font-size: 1em; display: flex; align-items: center; gap: 2.5mm; }
.ac-dot { width: 1mm; height: 1mm; border-radius: 50%; background: ${b.accent}; display: inline-block; }
.ac-body { flex: 1; display: flex; flex-direction: column; gap: 3mm; padding: 4mm 6mm 5mm; min-height: 0; }
.ac-row { display: flex; gap: 5mm; align-items: flex-start; }
.ac-row-rev { flex-direction: row-reverse; }
.ac-main { flex: 1; min-width: 0; }
.ac-side { display: flex; flex-direction: column; align-items: center; gap: 2.5mm; }
.ac-sec { border: 0.75pt solid ${b.secondary}40; border-radius: 1.5mm; padding: 2.5mm 3mm 3mm; }
.ac-st { margin: 0 0 2mm; font-size: .82em; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; color: ${b.secondary}; }
.ac-grid { display: grid; gap: 2.2mm 4mm; }
.ac-fl { font-size: .74em; text-transform: uppercase; letter-spacing: .06em; color: ${b.text}99; }
.ac-fv { font-size: 1.05em; font-weight: 600; word-break: break-word; }
.ac-photo { border: 0.75pt solid ${b.primary}; display: flex; align-items: center; justify-content: center; text-align: center; overflow: hidden; background: #fff; font-size: .78em; color: ${b.text}aa; padding: 0; }
.ac-photo span { padding: 2mm; }
.ac-photo img { width: 100%; height: 100%; object-fit: cover; }
.ac-round { border-radius: 2mm; }
.ac-code { display: flex; flex-direction: column; align-items: center; gap: .8mm; }
.ac-code-svg svg { width: 100%; height: 100%; display: block; }
.ac-code-l { font-size: .68em; color: ${b.text}aa; }
.ac-auth { display: grid; gap: 6mm; padding-top: 1mm; margin-top: auto; }
.ac-sig { display: flex; flex-direction: column; align-items: center; text-align: center; }
.ac-sig-area { position: relative; height: 14mm; width: 100%; border-bottom: 0.75pt solid ${b.text}; display: flex; align-items: flex-end; justify-content: center; }
.ac-sig-img { max-height: 12mm; max-width: 40mm; object-fit: contain; }
.ac-stamp { position: absolute; right: 0; bottom: 1mm; height: 16mm; width: 16mm; object-fit: contain; opacity: .85; }
.ac-sig-l { font-size: .8em; margin-top: 1mm; font-weight: 600; }
.ac-sig-n { font-size: .82em; }
.ac-sig-d { font-size: .74em; color: ${b.text}aa; }
.ac-ins { border-top: 1pt solid ${b.primary}; padding-top: 2.5mm; }
.ac-it { margin: 0 0 1.5mm; font-size: 1em; font-weight: 800; color: ${b.primary}; text-transform: uppercase; letter-spacing: .08em; }
.ac-ins ol { margin: 0; padding-left: 5mm; font-size: .86em; display: grid; gap: .8mm; }
.ac-ack { margin-top: 3mm; display: flex; align-items: flex-end; justify-content: space-between; gap: 6mm; font-size: .85em; font-style: italic; }
.ac-ack p { margin: 0; }
.ac-ack-sig { font-style: normal; font-size: .9em; text-align: center; white-space: nowrap; }
.ac-ack-sig span { display: block; width: 45mm; border-bottom: .75pt solid ${b.text}; height: 9mm; margin-bottom: 1mm; }
.ac-back { padding: 6mm; display: block; }
.ac-back-h { display: flex; justify-content: space-between; font-weight: 700; color: ${b.primary}; border-bottom: 1pt solid ${b.primary}; padding-bottom: 2mm; margin-bottom: 3mm; }
.ac-back .ac-ins { border-top: 0; }

/* ---------- panel (three column) ---------- */
.ac-panelcard { display: grid; grid-template-columns: 19% 1fr 19%; background: ${b.panelBackground}; }
.pn-left, .pn-right { display: flex; flex-direction: column; align-items: center; padding: 3mm 2.5mm; min-height: 0; }
.pn-logo { width: 72%; max-height: 38%; object-fit: contain; }
.pn-logo2 { width: 88%; max-height: 42%; object-fit: contain; }
.pn-tag { font-size: .62em; font-weight: 600; text-align: center; margin: 1mm 0 2mm; line-height: 1.35; color: ${b.text}; }
.pn-left .ac-photo { border: 1pt solid ${b.primary}; font-size: .72em; flex: none; max-width: 100%; }
.pn-sigbox { width: ${t.photo.widthMm}mm; max-width: 100%; height: 11mm; border: .75pt solid ${b.primary}; margin-top: 2mm; display: flex; align-items: center; justify-content: center; }
.pn-sigl { font-size: .68em; margin-top: .8mm; }
.pn-center { display: flex; flex-direction: column; background: ${b.secondary}; min-width: 0; min-height: 0; }
.pn-title { background: ${b.primary}; color: #fff; text-align: center; font-weight: 700; font-size: 1.9em; letter-spacing: .02em; padding: 1.8mm 3mm; }
.pn-body { flex: 1; padding: 3.5mm 6mm 2mm; display: flex; flex-direction: column; gap: 3mm; min-height: 0; }
.pn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3.2mm 6mm; }
.pn-f { font-size: 1.12em; color: ${b.text}; line-height: 1.25; }
.pn-l { font-weight: 600; }
.pn-v { font-weight: 700; }
.pn-ins { margin-top: auto; }
.pn-ins .ac-it { text-transform: none; letter-spacing: 0; font-size: 1.25em; color: #111; margin-bottom: .8mm; }
.pn-ins ol { list-style: disc; margin: 0; padding-left: 4mm; font-size: .84em; color: #333; display: grid; gap: .3mm; }
.pn-foot { background: ${b.primary}; color: #fff; font-size: .66em; padding: 1.2mm 6mm; }
.pn-contact { font-size: .7em; text-align: left; width: 100%; margin-top: auto; line-height: 1.3; }
.pn-ct { text-align: center; font-weight: 600; margin-bottom: 1.8mm; }
.pn-gap { height: 1.6mm; }
.pn-right .ac-code { margin-top: 2mm; }
.pn-auth { margin-top: 2mm; text-align: center; }
`;
}

function lighten(hex: string): string {
  // Accent on a dark header: keep as-is; fallback for very dark accents is white.
  const h = hex.replace("#", "");
  if (h.length < 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const bl = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * bl < 110 ? "#ffffff" : hex;
}

/** Lay out rendered cards into pages (N per page, optional back pages after each front page). */
export function paginate(t: TemplateConfig, cards: RenderedCard[], perPage = t.page.cardsPerPage): string {
  const pages: string[] = [];
  for (let i = 0; i < cards.length; i += perPage) {
    const group = cards.slice(i, i + perPage);
    pages.push(`<div class="ac-page">${group.map((c) => `<div class="ac-slot">${c.front}</div>`).join("")}</div>`);
    if (group.some((c) => c.back)) {
      pages.push(`<div class="ac-page">${group.map((c) => `<div class="ac-slot">${c.back ?? ""}</div>`).join("")}</div>`);
    }
  }
  return pages.join("\n");
}

export function htmlDocument(opts: { css: string; fontCss: string; body: string; title?: string; extraHead?: string }): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${e(opts.title ?? "Admit Card")}</title>
<style>${opts.fontCss}</style><style>${opts.css}</style>${opts.extraHead ?? ""}</head><body>${opts.body}</body></html>`;
}
