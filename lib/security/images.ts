import dns from "node:dns/promises";
import net from "node:net";
import { env } from "@/lib/env";

export type ImageMime = "image/png" | "image/jpeg" | "image/webp";

/** Identify an image purely by magic bytes (never trust client-provided MIME types). */
export function sniffImage(buf: Buffer): ImageMime | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export const extFor = (m: ImageMime) => (m === "image/png" ? "png" : m === "image/jpeg" ? "jpg" : "webp");

export function toDataUri(buf: Buffer, mime: string): string {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const x = ip.toLowerCase();
  if (x.startsWith("::ffff:")) return isPrivateIp(x.slice(7));
  return x === "::1" || x === "::" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80");
}

async function assertPublicHost(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http(s) photo URLs are allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error("Photo URL points to a private or local network address");
  }
}

/**
 * Fetch a remote image with SSRF protection, timeouts, redirect re-validation and size limits.
 * Returns the validated image buffer and its sniffed MIME type.
 */
export async function fetchRemoteImage(rawUrl: string): Promise<{ buf: Buffer; mime: ImageMime }> {
  if (!env.allowRemotePhotos) throw new Error("Remote photo URLs are disabled (ALLOW_REMOTE_PHOTOS=false)");
  let url = new URL(rawUrl);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(url);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, { redirect: "manual", signal: ctrl.signal, headers: { accept: "image/*" } });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, url);
        continue;
      }
      if (!res.ok || !res.body) throw new Error(`Photo URL returned HTTP ${res.status}`);
      const len = Number(res.headers.get("content-length") ?? 0);
      if (len > env.maxImageBytes) throw new Error("Photo is larger than the allowed size");
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > env.maxImageBytes) {
          ctrl.abort();
          throw new Error("Photo is larger than the allowed size");
        }
        chunks.push(value);
      }
      const buf = Buffer.concat(chunks);
      const mime = sniffImage(buf);
      if (!mime) throw new Error("Photo URL did not return a PNG, JPEG or WebP image");
      return { buf, mime };
    } catch (err) {
      if ((err as Error).name === "AbortError") throw new Error("Timed out downloading photo");
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Too many redirects fetching photo");
}
