import { cleanupExpiredImports, processNextImport } from "./imports";
import { healthcareDb } from "./store";

export function startHealthcareImportWorker() {
  let active: Promise<void> | undefined;
  let nextCleanup = 0;
  const tick = () => {
    if (active) return;
    active = (async () => {
      const db = await healthcareDb();
      if (Date.now() >= nextCleanup) {
        nextCleanup = Date.now() + 5_000;
        await cleanupExpiredImports(db);
      }
      await processNextImport(db);
    })().catch(() => {
      console.error("[healthcare-import] Không thể chạy hàng đợi. Worker sẽ thử lại.");
    }).finally(() => { active = undefined; });
  };
  const timer = setInterval(tick, 1_000);
  timer.unref();
  tick();
  return async () => {
    clearInterval(timer);
    await active;
  };
}
