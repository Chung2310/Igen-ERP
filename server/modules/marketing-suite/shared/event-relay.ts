import Redis from "ioredis";
import { emitToCompany, emitToUser, emitToMarketingRoom } from "../../../socket";
type Audience = { kind: "company" | "user" | "account"; id: string };
let publisher: Redis | undefined;
let subscriber: Redis | undefined;
const channel = () => `${process.env.MARKETING_QUEUE_PREFIX || "igen-erp-marketing"}:events`;
function client() {
  return new Redis({ host: process.env.REDIS_HOST || "127.0.0.1", port: Number(process.env.REDIS_PORT) || 6379, password: process.env.REDIS_PASSWORD || undefined, lazyConnect: true, maxRetriesPerRequest: 1 });
}
function emit(audience: Audience, event: string, payload: unknown) {
  if (audience.kind === "company") emitToCompany(audience.id, event, payload);
  else if (audience.kind === "user") emitToUser(audience.id, event, payload);
  else if (audience.kind === "account") emitToMarketingRoom(audience.id, event, payload);
}
export function relayMarketingEvent(audience: Audience, event: string, payload: unknown) {
  if (process.env.MARKETING_WORKER_PROCESS !== "true") return emit(audience, event, payload);
  publisher ||= client();
  void publisher.publish(channel(), JSON.stringify({ audience, event, payload })).catch((error: unknown) => console.warn("[Marketing event relay]", error instanceof Error ? error.message : "unavailable"));
}
export async function startMarketingEventRelay() {
  if (!process.env.MARKETING_QUEUE_PREFIX || subscriber) return;
  subscriber = client();
  subscriber.on("error", (error) => console.warn("[Marketing event subscriber]", error.message));
  subscriber.on("message", (_channel, text) => {
    try {
      const data = JSON.parse(text) as { audience: Audience; event: string; payload: unknown };
      if (!data.audience || !["company", "user", "account"].includes(data.audience.kind) || typeof data.audience.id !== "string" || !data.audience.id || typeof data.event !== "string" || data.event.length > 120) return;
      emit(data.audience, data.event, data.payload);
    } catch { /* Ignore malformed messages on this application channel. */ }
  });
  await subscriber.subscribe(channel());
}
export async function stopMarketingEventRelay() {
  await Promise.allSettled([publisher?.quit(), subscriber?.quit()]);
  publisher = undefined; subscriber = undefined;
}
