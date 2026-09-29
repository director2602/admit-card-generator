/**
 * Minimal structured logger. By policy, callers pass only identifiers and counts —
 * never candidate names, dates of birth or full records.
 */
type Meta = Record<string, string | number | boolean | null | undefined>;

function emit(level: "info" | "warn" | "error", event: string, meta?: Meta) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...meta });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, meta?: Meta) => emit("info", event, meta),
  warn: (event: string, meta?: Meta) => emit("warn", event, meta),
  error: (event: string, meta?: Meta) => emit("error", event, meta),
};
