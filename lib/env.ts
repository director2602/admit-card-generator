import fs from "node:fs";
import path from "node:path";

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function detectChromium(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const candidates = [
    "/opt/pw-browsers/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  return candidates.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
}

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  authSecret: process.env.AUTH_SECRET ?? "",
  allowSignup: (process.env.ALLOW_SIGNUP ?? "true") === "true",
  storageDriver: (process.env.STORAGE_DRIVER ?? "local") as "local" | "s3",
  localStorageDir: path.resolve(process.env.LOCAL_STORAGE_DIR ?? "./storage"),
  s3: {
    bucket: process.env.S3_BUCKET ?? "",
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
  },
  chromiumPath: detectChromium(),
  pdfConcurrency: num("PDF_CONCURRENCY", 4),
  jobChunkSize: num("JOB_CHUNK_SIZE", 25),
  workerMode: (process.env.WORKER_MODE ?? "inline") as "inline" | "external",
  maxCsvBytes: num("MAX_CSV_MB", 10) * 1024 * 1024,
  maxCsvRows: num("MAX_CSV_ROWS", 20000),
  maxImageBytes: num("MAX_IMAGE_MB", 2) * 1024 * 1024,
  maxPhotoZipBytes: num("MAX_PHOTO_ZIP_MB", 200) * 1024 * 1024,
  allowRemotePhotos: (process.env.ALLOW_REMOTE_PHOTOS ?? "true") === "true",
  defaultRetentionDays: num("DEFAULT_RETENTION_DAYS", 30),
};

export function requireSecret(): Uint8Array {
  const s = env.authSecret;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters.");
  }
  return new TextEncoder().encode(s);
}
