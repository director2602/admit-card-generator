/** Client-side CSV decoding + parsing (Papa Parse). */
import Papa from "papaparse";

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  encoding: string;
  errors: string[];
}

/** Decode bytes as UTF-8 (with BOM), UTF-16 (with BOM) or fall back to Windows-1252. */
export function decodeCsvBytes(buf: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buf);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder("utf-16le").decode(bytes), encoding: "UTF-16 LE" };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder("utf-16be").decode(bytes), encoding: "UTF-16 BE" };
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { text: text.replace(/^﻿/, ""), encoding: "UTF-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(bytes), encoding: "Windows-1252 (fallback)" };
  }
}

export function parseCsvText(text: string, maxRows: number): ParsedCsv {
  const res = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const headers = (res.meta.fields ?? []).filter((h) => h.length > 0);
  const errors = res.errors.slice(0, 20).map((e) => `Row ${(e.row ?? 0) + 1}: ${e.message}`);
  let rows = res.data;
  if (rows.length > maxRows) {
    errors.unshift(`File has ${rows.length} rows; only the first ${maxRows} were loaded.`);
    rows = rows.slice(0, maxRows);
  }
  const seen = new Set<string>();
  for (const h of headers) {
    if (seen.has(h)) errors.unshift(`Duplicate column header "${h}" — only the last one is used.`);
    seen.add(h);
  }
  return { headers, rows, encoding: "", errors };
}

export async function parseCsvFile(file: File, maxRows = 20000): Promise<ParsedCsv> {
  const { text, encoding } = decodeCsvBytes(await file.arrayBuffer());
  const parsed = parseCsvText(text, maxRows);
  return { ...parsed, encoding };
}
