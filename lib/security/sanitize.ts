/** Isomorphic sanitisation helpers. */

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Trim, strip control chars and bound length of a CSV cell. */
export function cleanCell(value: unknown, max = 500): string {
  if (value === null || value === undefined) return "";
  let s = String(value).replace(CONTROL, "").replace(/\r\n?/g, "\n").trim();
  if (s.length > max) s = s.slice(0, max);
  return s;
}

/**
 * Neutralise spreadsheet formula injection for exported CSV cells.
 * Any cell starting with = + - @ tab or CR is prefixed with a single quote.
 */
export function csvSafe(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: unknown[][]): string {
  return "﻿" + rows.map((r) => r.map(csvSafe).join(",")).join("\r\n") + "\r\n";
}

/** Make a safe filename segment: no path separators, no traversal, limited charset. */
export function safeFileSegment(input: string, max = 100): string {
  const s = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._-]+/, "")
    .replace(/_+/g, "_")
    .slice(0, max)
    .replace(/[._-]+$/, "");
  return s || "file";
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Replace {{field}} tokens with values. */
export function fillTokens(pattern: string, data: Record<string, string>): string {
  return pattern.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k: string) => data[k] ?? "");
}

export function isSafeColor(c: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(c);
}
