import type { TemplateConfig } from "@/lib/template/types";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string, fmt: TemplateConfig["dateFormat"]): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  switch (fmt) {
    case "DD/MM/YYYY":
      return `${d}/${mo}/${y}`;
    case "D MMM YYYY":
      return `${Number(d)} ${MON[Number(mo) - 1]} ${y}`;
    case "YYYY-MM-DD":
      return iso;
    default:
      return `${d}-${mo}-${y}`;
  }
}

const DATE_KEYS = new Set(["date_of_birth", "exam_date"]);

/** Produce display values: formatted dates, trimmed text. */
export function displayData(data: Record<string, string>, t: TemplateConfig): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = DATE_KEYS.has(k) && v ? formatDate(v, t.dateFormat) : v;
  }
  return out;
}
