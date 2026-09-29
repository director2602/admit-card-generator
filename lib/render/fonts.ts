import fs from "node:fs";
import path from "node:path";
import type { TemplateConfig } from "@/lib/template/types";
import { FONT_OPTIONS } from "@/lib/template/types";

const FONT_DIR = path.resolve(process.cwd(), "assets/fonts");
const WEIGHTS = [400, 500, 600, 700, 800];
const cache = new Map<string, string>();

export function fontFilePath(file: string): string | null {
  if (!/^[a-z0-9-]+-\d{3}\.woff2$/.test(file)) return null;
  const p = path.join(FONT_DIR, file);
  return fs.existsSync(p) ? p : null;
}

function src(file: string, mode: "url" | "data"): string | null {
  const p = fontFilePath(file);
  if (!p) return null;
  if (mode === "url") return `url('/api/fonts/${file}') format('woff2')`;
  let d = cache.get(file);
  if (!d) {
    d = `url(data:font/woff2;base64,${fs.readFileSync(p).toString("base64")}) format('woff2')`;
    cache.set(file, d);
  }
  return d;
}

function faces(familyKey: string, familyName: string, weights: number[], mode: "url" | "data"): string {
  return weights
    .map((w) => {
      const s = src(`${familyKey}-${w}.woff2`, mode);
      return s ? `@font-face{font-family:'${familyName}';font-style:normal;font-weight:${w};font-display:block;src:${s};}` : "";
    })
    .join("\n");
}

/** @font-face rules for the template's font family plus Noto fallbacks (Latin + Devanagari). */
export function fontCss(t: TemplateConfig, mode: "url" | "data"): string {
  const f = FONT_OPTIONS.find((x) => x.key === t.branding.fontFamily) ?? FONT_OPTIONS[0];
  const name = f.css.replace(/'/g, "");
  const parts = [faces(f.key, name, WEIGHTS, mode)];
  if (f.key !== "noto-sans") parts.push(faces("noto-sans", "Noto Sans", [400, 700], mode));
  parts.push(faces("noto-sans-devanagari", "Noto Sans Devanagari", [400, 600, 700], mode));
  return parts.join("\n");
}
