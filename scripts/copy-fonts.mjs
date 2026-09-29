// Copies the self-hosted fonts used for PDF rendering into ./assets/fonts.
// Runs on postinstall so PDF output never depends on network font loading.
import fs from "node:fs";
import path from "node:path";

const families = ["montserrat", "poppins", "noto-sans", "source-sans-3", "noto-serif", "merriweather"];
const weights = [400, 500, 600, 700, 800];
const out = path.resolve("assets/fonts");
fs.mkdirSync(out, { recursive: true });
let n = 0;
function copy(src, dest) {
  if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(out, dest)); n++; }
}
for (const f of families)
  for (const w of weights)
    copy(`node_modules/@fontsource/${f}/files/${f}-latin-${w}-normal.woff2`, `${f}-${w}.woff2`);
for (const w of [400, 600, 700])
  copy(`node_modules/@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-${w}-normal.woff2`, `noto-sans-devanagari-${w}.woff2`);
console.log(`copy-fonts: ${n} font files -> ${out}`);
