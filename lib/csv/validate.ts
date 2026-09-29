/**
 * Row mapping + validation. Isomorphic: used for the instant client-side preview
 * and re-run authoritatively on the server before anything is persisted.
 */
import { STANDARD_FIELDS, type FieldMapping } from "@/lib/fields";
import { cleanCell } from "@/lib/security/sanitize";

export type DuplicatePolicy = "skip" | "flag" | "manual";

export interface RowError {
  field: string;
  message: string;
}

export interface ValidatedRecord {
  rowNumber: number; // 1-based data row number (header excluded)
  data: Record<string, string>;
  status: "valid" | "invalid" | "duplicate";
  flagged: boolean;
  errors: RowError[];
}

export interface ValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  flagged: number;
  duplicateGroups: { key: string; rows: number[] }[];
}

export interface ValidationResult {
  records: ValidatedRecord[];
  summary: ValidationSummary;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function validYmd(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= dim;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Parse many common date formats into ISO YYYY-MM-DD. Day-first for ambiguous numeric dates. */
export function parseDate(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    return validYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) {
    let [d, mo, y] = [+m[1], +m[2], +m[3]];
    if (y < 100) y += y > 50 ? 1900 : 2000;
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]; // clearly month-first
    return validYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,9})[,\s-]+(\d{4})$/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
    const [d, y] = [+m[1], +m[3]];
    return mo && validYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    const [d, y] = [+m[2], +m[3]];
    return mo && validYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  return null;
}

export function looksLikeTime(s: string): boolean {
  if (s.length > 60) return false;
  return /\d{1,2}[:.]\d{2}/.test(s) || /\b\d{1,2}\s*(am|pm|a\.m\.|p\.m\.)/i.test(s);
}

const IMG_EXT = /\.(png|jpe?g|webp)$/i;

export function classifyImageRef(v: string): "url" | "file" | "demo" | "invalid" {
  if (/^demo:avatar-\d{1,3}$/.test(v)) return "demo";
  if (/^https?:\/\/[^\s]+$/i.test(v)) return "url";
  if (IMG_EXT.test(v) && !/[\\/]|\.\./.test(v) && v.length <= 200) return "file";
  return "invalid";
}

function normalizeGender(v: string): string {
  const x = v.trim().toLowerCase();
  if (["m", "male", "boy"].includes(x)) return "Male";
  if (["f", "female", "girl"].includes(x)) return "Female";
  if (["o", "other", "others", "transgender", "t"].includes(x)) return "Other";
  return v.trim();
}

export function mapRow(row: Record<string, unknown>, mapping: FieldMapping): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, src] of Object.entries(mapping.fields)) {
    if (src.type === "column") out[key] = cleanCell(row[src.column]);
    else if (src.type === "constant") out[key] = cleanCell(src.value);
  }
  return out;
}

export function validateRows(
  rows: Record<string, unknown>[],
  mapping: FieldMapping,
  policy: DuplicatePolicy = "skip",
  /** For manual policy: duplicate key -> row number to keep. */
  resolutions: Record<string, number> = {},
): ValidationResult {
  const required = new Set<string>([
    ...STANDARD_FIELDS.filter((f) => f.required).map((f) => f.key),
    ...(mapping.extraRequired ?? []),
    ...mapping.customFields.filter((c) => c.required).map((c) => c.key),
  ]);

  const records: ValidatedRecord[] = rows.map((row, i) => {
    const data = mapRow(row, mapping);
    const errors: RowError[] = [];
    for (const key of required) {
      if (!data[key]) errors.push({ field: key, message: "Required value is missing" });
    }
    for (const def of STANDARD_FIELDS) {
      const v = data[def.key];
      if (!v) continue;
      switch (def.kind) {
        case "date": {
          const iso = parseDate(v);
          if (!iso) errors.push({ field: def.key, message: `Unrecognised date "${v}" (use DD-MM-YYYY or YYYY-MM-DD)` });
          else data[def.key] = iso;
          break;
        }
        case "time":
          if (!looksLikeTime(v)) errors.push({ field: def.key, message: `Unrecognised time "${v}"` });
          break;
        case "photo":
        case "image":
          if (classifyImageRef(v) === "invalid")
            errors.push({ field: def.key, message: "Must be an http(s) URL or an image filename (.jpg, .png, .webp)" });
          break;
        case "gender":
          data[def.key] = normalizeGender(v);
          break;
        default:
          break;
      }
    }
    if (data.roll_number && !/^[A-Za-z0-9/_.-]{1,40}$/.test(data.roll_number)) {
      errors.push({ field: "roll_number", message: "Roll number may only contain letters, digits and / _ . -" });
    }
    return {
      rowNumber: i + 1,
      data,
      status: errors.length ? "invalid" : "valid",
      flagged: false,
      errors,
    };
  });

  // Duplicate detection on roll number (primary identity) and application number.
  const groups = new Map<string, number[]>();
  for (const r of records) {
    for (const k of ["roll_number", "application_number"] as const) {
      const v = r.data[k]?.toUpperCase();
      if (!v) continue;
      const gk = `${k}:${v}`;
      const arr = groups.get(gk) ?? [];
      arr.push(r.rowNumber);
      groups.set(gk, arr);
    }
  }
  const duplicateGroups = [...groups.entries()]
    .filter(([, rs]) => rs.length > 1)
    .map(([key, rs]) => ({ key, rows: rs }));

  for (const g of duplicateGroups) {
    const label = g.key.startsWith("roll_number") ? "roll number" : "application number";
    const keep =
      policy === "manual" ? resolutions[g.key] ?? null : policy === "skip" ? g.rows[0] : null;
    for (const rn of g.rows) {
      const rec = records[rn - 1];
      if (policy === "flag") {
        rec.flagged = true;
        rec.errors.push({ field: g.key.split(":")[0], message: `Duplicate ${label} (rows ${g.rows.join(", ")}) — flagged` });
        continue;
      }
      if (keep === rn) continue;
      if (rec.status === "invalid") continue;
      rec.status = "duplicate";
      rec.errors.push({
        field: g.key.split(":")[0],
        message:
          keep === null
            ? `Duplicate ${label} (rows ${g.rows.join(", ")}) — choose which row to keep`
            : `Duplicate ${label} — row ${keep} kept, this row skipped`,
      });
    }
  }

  const summary: ValidationSummary = {
    total: records.length,
    valid: records.filter((r) => r.status === "valid").length,
    invalid: records.filter((r) => r.status === "invalid").length,
    duplicates: records.filter((r) => r.status === "duplicate").length,
    flagged: records.filter((r) => r.flagged).length,
    duplicateGroups,
  };
  return { records, summary };
}
