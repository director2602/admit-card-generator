// Standalone generation worker for WORKER_MODE=external deployments.
process.env.ACG_IS_WORKER = "1";
import { startWorker } from "../src/lib/jobs/engine";
import { purgeExpired } from "../src/lib/services/retention";
import { closeBrowser } from "../src/lib/pdf/browser";

startWorker();
setInterval(() => purgeExpired().catch((e) => console.error("retention", String(e))), 60 * 60 * 1000);
console.log("Admit card worker started");

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    await closeBrowser();
    process.exit(0);
  });
}
