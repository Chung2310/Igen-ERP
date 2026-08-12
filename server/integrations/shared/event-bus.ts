import type { ClientSession } from "mongoose";
import { DomainEventModel } from "./domain-event.model";
import type { DomainEventType, NewDomainEvent } from "./event-types";

export type DomainConsumer = { eventType: DomainEventType; name: string; handler: (event: any) => Promise<void>; requiresModule?: string };
const registry = new Map<string, DomainConsumer>();
const key = (eventType: string, name: string) => `${eventType}:${name}`;

export function registerDomainConsumer(eventType: DomainEventType, name: string, handler: DomainConsumer["handler"], options: { requiresModule?: string } = {}) {
  const registryKey = key(eventType, name);
  if (registry.has(registryKey)) throw new Error(`Consumer ${name} đã được đăng ký cho ${eventType}.`);
  registry.set(registryKey, { eventType, name, handler, requiresModule: options.requiresModule });
}
export function getDomainConsumer(eventType: DomainEventType, name: string) { return registry.get(key(eventType, name)); }
export function clearDomainConsumersForTests() { registry.clear(); }

export async function publishDomainEvent<T extends DomainEventType>(input: NewDomainEvent<T>, session?: ClientSession, repository: Pick<typeof DomainEventModel, "create"> = DomainEventModel) {
  const consumers = [...registry.values()].filter((item) => item.eventType === input.eventType);
  await repository.create([{ ...input, payload: structuredClone(input.payload), deliveries: consumers.map((item) => ({ consumer: item.name, status: "pending", attempts: 0, nextAttemptAt: input.occurredAt })) }], { session });
}
