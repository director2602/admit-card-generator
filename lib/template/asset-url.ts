import type { AssetRef } from "./types";

export function assetUrl(ref: AssetRef): string | null {
  if (!ref) return null;
  if (ref.startsWith("asset:")) return `/api/assets/${ref.slice(6)}`;
  if (ref.startsWith("builtin:")) return `/api/builtin/${ref.slice(8)}`;
  return null;
}
