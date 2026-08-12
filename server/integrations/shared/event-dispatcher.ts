import { domainRetryDelay } from "./retry-policy";
import { getDomainConsumer } from "./event-bus";

export type DeliveryResult = { status: "pending" | "done" | "skipped" | "failed"; attempts: number; lastError?: string; nextAttemptAt?: Date; completedAt?: Date };
export async function dispatchDomainDelivery(event: any, consumerName: string, options: { moduleEnabled: (companyCode: string, module: string) => Promise<boolean>; previousAttempts?: number; now?: Date }): Promise<DeliveryResult> {
  const consumer = getDomainConsumer(event.eventType, consumerName);
  const attempts = options.previousAttempts || 0;
  if (!consumer) return { status: "skipped", attempts };
  if (consumer.requiresModule && !(await options.moduleEnabled(event.companyCode, consumer.requiresModule))) return { status: "skipped", attempts };
  const now = options.now || new Date();
  try { await consumer.handler(event); return { status: "done", attempts: attempts + 1, completedAt: now }; }
  catch (error) { const nextAttempts = attempts + 1; const lastError = error instanceof Error ? error.message : String(error); if (nextAttempts >= 5) return { status: "failed", attempts: nextAttempts, lastError }; return { status: "pending", attempts: nextAttempts, lastError, nextAttemptAt: new Date(now.getTime() + domainRetryDelay(nextAttempts)) }; }
}
