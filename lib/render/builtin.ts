/**
 * Built-in artwork: a neutral demo logo, fictional demo avatars, and the
 * SATHII / S-CUBUS logos supplied by the organisation for their template preset.
 */
import fs from "node:fs";
import path from "node:path";
import { toDataUri } from "@/lib/security/images";

const DIR = path.resolve(process.cwd(), "assets/builtin");

const DEMO_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<circle cx="60" cy="60" r="56" fill="#1f2a5c"/><circle cx="60" cy="60" r="47" fill="none" stroke="#b8862b" stroke-width="3"/>
<path d="M60 26 L92 42 L60 58 L28 42 Z" fill="#fff"/><path d="M40 50 v16 c0 8 40 8 40 0 v-16 l-20 10 z" fill="#fff" opacity=".9"/>
<path d="M88 44 v18" stroke="#b8862b" stroke-width="3" stroke-linecap="round"/><circle cx="88" cy="64" r="3.5" fill="#b8862b"/>
<text x="60" y="92" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="#fff" letter-spacing="2">DEMO</text>
</svg>`;

const PALETTE = ["#dbe4ff", "#ffe3e3", "#e6fcf5", "#fff3bf", "#f3d9fa", "#e3fafc", "#ffe8cc", "#e9ecef"];
const SKIN = ["#f1c7a5", "#d9a47c", "#c68a5f", "#a86b45", "#e8b894", "#8d5a3b"];
const HAIR = ["#2b2118", "#3d2b1f", "#1b1b1b", "#5a3825", "#111"];

/** Fictional placeholder avatar used only by demo data. */
export function demoAvatarSvg(n: number): string {
  const bg = PALETTE[n % PALETTE.length];
  const skin = SKIN[(n * 7) % SKIN.length];
  const hair = HAIR[(n * 3) % HAIR.length];
  const shirt = ["#1f2a5c", "#3c4b8f", "#2f6f5e", "#7a3b69", "#8a5a14"][n % 5];
  const longHair = n % 2 === 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150">
<rect width="120" height="150" fill="${bg}"/>
${longHair ? `<path d="M30 70 Q28 30 60 26 Q92 30 90 70 L92 112 L28 112 Z" fill="${hair}"/>` : ""}
<path d="M18 150 Q20 112 60 108 Q100 112 102 150 Z" fill="${shirt}"/>
<rect x="51" y="86" width="18" height="22" rx="6" fill="${skin}"/>
<ellipse cx="60" cy="66" rx="25" ry="29" fill="${skin}"/>
<path d="M35 60 Q36 34 60 33 Q84 34 85 60 Q78 44 60 44 Q42 44 35 60 Z" fill="${hair}"/>
<circle cx="51" cy="68" r="2.6" fill="#2b2118"/><circle cx="69" cy="68" r="2.6" fill="#2b2118"/>
<path d="M52 81 Q60 86 68 81" stroke="#7a4a3a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<text x="60" y="144" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" fill="#fff" opacity=".85">SAMPLE</text>
</svg>`;
}

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const fileCache = new Map<string, string>();

export const BUILTIN_ASSETS = ["demo-logo", "sathii-logo", "scubus-logo"] as const;

export function builtinDataUri(name: string): string | null {
  if (name === "demo-logo") return svgUri(DEMO_LOGO);
  const m = name.match(/^demo-avatar-(\d{1,3})$/);
  if (m) return svgUri(demoAvatarSvg(Number(m[1])));
  if (name === "sathii-logo" || name === "scubus-logo") {
    let v = fileCache.get(name);
    if (!v) {
      const p = path.join(DIR, `${name}.png`);
      if (!fs.existsSync(p)) return null;
      v = toDataUri(fs.readFileSync(p), "image/png");
      fileCache.set(name, v);
    }
    return v;
  }
  return null;
}
