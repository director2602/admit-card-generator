export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if ((process.env.WORKER_MODE ?? "inline") !== "inline") return;
  const { startWorker } = await import("@/lib/jobs/engine");
  const { purgeExpired } = await import("@/lib/services/retention");
  startWorker();
  const t = setInterval(() => purgeExpired().catch((e) => console.error("retention", String(e))), 60 * 60 * 1000);
  t.unref?.();
}
