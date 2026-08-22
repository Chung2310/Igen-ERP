import { randomUUID } from "node:crypto";
import type { ModuleKey } from "../../config/module-keys";
import { getModuleStateForCompany, resolveModuleAccess } from "../../middleware/require-module";
import { DomainEventModel } from "./domain-event.model";
import { dispatchDomainDelivery, type DeliveryResult } from "./event-dispatcher";

const DEFAULT_LEASE_MS = 30_000;
const DEFAULT_BATCH_SIZE = 100;

export type ClaimedDelivery = {
  event: any;
  consumer: string;
  attempts: number;
  leaseUntil: Date;
  claimToken: string;
};

export interface DomainEventWorkerRepository {
  claim(now: Date, leaseUntil: Date): Promise<ClaimedDelivery | null>;
  complete(claim: ClaimedDelivery, result: DeliveryResult): Promise<void>;
}

type WorkerDependencies = {
  repository: DomainEventWorkerRepository;
  dispatch: typeof dispatchDomainDelivery;
  moduleEnabled: (companyCode: string, module: string) => Promise<boolean>;
  leaseMs?: number;
  maxBatchSize?: number;
  now?: () => Date;
};

async function moduleEnabled(companyCode: string, module: string) {
  const state = await getModuleStateForCompany(companyCode);
  return resolveModuleAccess(
    { companyCode },
    module as ModuleKey,
    state.modules,
    state.exists,
    state.businessType,
  );
}

export const mongooseDomainEventWorkerRepository: DomainEventWorkerRepository = {
  async claim(now, leaseUntil) {
    const claimToken = randomUUID();
    const due = {
      $or: [
        { status: "pending", nextAttemptAt: { $lte: now } },
        { status: "processing", leaseUntil: { $lte: now } },
      ],
    };
    const event: any = await DomainEventModel.findOneAndUpdate(
      { deliveries: { $elemMatch: due } },
      { $set: { "deliveries.$.status": "processing", "deliveries.$.leaseUntil": leaseUntil, "deliveries.$.claimToken": claimToken } },
      { returnDocument: 'after', sort: { occurredAt: 1, _id: 1 } },
    ).lean();
    if (!event) return null;
    const delivery = event.deliveries.find((item: any) => item.claimToken === claimToken);
    if (!delivery) throw new Error("DOMAIN_EVENT_CLAIM_NOT_FOUND");
    return { event, consumer: delivery.consumer, attempts: delivery.attempts, leaseUntil, claimToken };
  },

  async complete(claim, result) {
    const filter = {
      _id: claim.event._id,
      deliveries: { $elemMatch: { consumer: claim.consumer, status: "processing", claimToken: claim.claimToken } },
    };
    const set: Record<string, unknown> = {
      "deliveries.$.status": result.status,
      "deliveries.$.attempts": result.attempts,
    };
    const unset: Record<string, 1> = { "deliveries.$.leaseUntil": 1, "deliveries.$.claimToken": 1 };
    if (result.lastError) set["deliveries.$.lastError"] = result.lastError;
    else unset["deliveries.$.lastError"] = 1;
    if (result.nextAttemptAt) set["deliveries.$.nextAttemptAt"] = result.nextAttemptAt;
    else unset["deliveries.$.nextAttemptAt"] = 1;
    if (result.completedAt) set["deliveries.$.completedAt"] = result.completedAt;
    else unset["deliveries.$.completedAt"] = 1;
    await DomainEventModel.updateOne(filter, { $set: set, $unset: unset });
  },
};

export async function processDomainEventDeliveries(
  now?: Date,
  dependencies: WorkerDependencies = {
    repository: mongooseDomainEventWorkerRepository,
    dispatch: dispatchDomainDelivery,
    moduleEnabled,
  },
) {
  let processed = 0;
  const leaseMs = dependencies.leaseMs || DEFAULT_LEASE_MS;
  const maxBatchSize = dependencies.maxBatchSize || DEFAULT_BATCH_SIZE;
  const clock = dependencies.now || (() => now || new Date());
  while (processed < maxBatchSize) {
    const claimedAt = clock();
    const claimed = await dependencies.repository.claim(claimedAt, new Date(claimedAt.getTime() + leaseMs));
    if (!claimed) break;
    const result = await dependencies.dispatch(claimed.event, claimed.consumer, {
      moduleEnabled: dependencies.moduleEnabled,
      previousAttempts: claimed.attempts,
      now: claimedAt,
    });
    await dependencies.repository.complete(claimed, result);
    processed += 1;
  }
  return { processed };
}

export function startDomainEventWorker(intervalMs = 1_000) {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    void processDomainEventDeliveries()
      .catch((error) => console.error("[domain-event-worker]", error))
      .finally(() => { running = false; });
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return timer;
}
