import mongoose from "mongoose";
import { recoverAdminActionAudits } from "../../../../super-admin/action-audit-outbox";
import { recoverPendingAiSettlements } from "./ai-subscription.service";

let timer: ReturnType<typeof setInterval> | undefined;
let running = false;
export function startSubscriptionRecovery(): void {
  if (timer) return;
  const recover = async () => {
    if (running || mongoose.connection.readyState !== 1) return;
    running = true;
    try {
      const results = await Promise.allSettled([recoverAdminActionAudits(), recoverPendingAiSettlements()]);
      if (results.some((result) => result.status === "rejected")) console.warn("[AI subscription] Recovery incomplete; durable entries will be retried.");
    } finally { running = false; }
  };
  void recover();
  timer = setInterval(() => { void recover(); }, 15_000);
  timer.unref();
}
