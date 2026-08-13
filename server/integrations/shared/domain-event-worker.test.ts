import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { DeliveryResult } from "./event-dispatcher";
import {
  processDomainEventDeliveries,
  type ClaimedDelivery,
  type DomainEventWorkerRepository,
} from "./domain-event-worker";

function claim(consumer = "finance.receivable-open", attempts = 0): ClaimedDelivery {
  return {
    event: { eventId: "evt-1", eventType: "retail.order.confirmed", companyCode: "ACME" },
    consumer,
    attempts,
    leaseUntil: new Date("2026-08-13T01:00:30.000Z"),
    claimToken: "claim-1",
  };
}

test("worker dispatches each claimed due delivery and persists the result", async () => {
  const claims = [claim(), null];
  const completed: Array<{ item: ClaimedDelivery; result: DeliveryResult }> = [];
  const repository: DomainEventWorkerRepository = {
    claim: async () => claims.shift() || null,
    complete: async (item, result) => { completed.push({ item, result }); },
  };
  const now = new Date("2026-08-13T01:00:00.000Z");
  const result = await processDomainEventDeliveries(now, {
    repository,
    dispatch: async (_event, consumer, options) => {
      assert.equal(consumer, "finance.receivable-open");
      assert.equal(options.previousAttempts, 0);
      assert.equal(await options.moduleEnabled("ACME", "finance"), true);
      return { status: "done", attempts: 1, completedAt: now };
    },
    moduleEnabled: async () => true,
  });

  assert.deepEqual(result, { processed: 1 });
  assert.equal(completed.length, 1);
  assert.deepEqual(completed[0].result, { status: "done", attempts: 1, completedAt: now });
});

test("worker processes a claimed delivery only once and persists retry metadata", async () => {
  let available = true;
  let dispatches = 0;
  let saved: DeliveryResult | undefined;
  const repository: DomainEventWorkerRepository = {
    claim: async () => {
      if (!available) return null;
      available = false;
      return claim("finance.receivable-open", 3);
    },
    complete: async (_item, result) => { saved = result; },
  };
  const nextAttemptAt = new Date("2026-08-13T02:00:00.000Z");

  await processDomainEventDeliveries(new Date("2026-08-13T01:00:00.000Z"), {
    repository,
    dispatch: async () => {
      dispatches += 1;
      return { status: "pending", attempts: 4, lastError: "network", nextAttemptAt };
    },
    moduleEnabled: async () => true,
  });

  assert.equal(dispatches, 1);
  assert.deepEqual(saved, { status: "pending", attempts: 4, lastError: "network", nextAttemptAt });
});

test("worker computes a fresh lease for each claim and caps one drain batch", async () => {
  const claimTimes: Date[] = [];
  const leaseTimes: Date[] = [];
  let available = 3;
  const clock = [
    new Date("2026-08-13T01:00:00.000Z"),
    new Date("2026-08-13T01:00:05.000Z"),
  ];
  const repository: DomainEventWorkerRepository = {
    claim: async (claimedAt, leaseUntil) => {
      claimTimes.push(claimedAt);
      leaseTimes.push(leaseUntil);
      return available-- > 0 ? claim() : null;
    },
    complete: async () => undefined,
  };

  const result = await processDomainEventDeliveries(undefined, {
    repository,
    dispatch: async () => ({ status: "done", attempts: 1 }),
    moduleEnabled: async () => true,
    leaseMs: 30_000,
    maxBatchSize: 2,
    now: () => clock.shift() || new Date("2026-08-13T01:00:10.000Z"),
  });

  assert.deepEqual(result, { processed: 2 });
  assert.deepEqual(claimTimes.map((value) => value.toISOString()), ["2026-08-13T01:00:00.000Z", "2026-08-13T01:00:05.000Z"]);
  assert.deepEqual(leaseTimes.map((value) => value.toISOString()), ["2026-08-13T01:00:30.000Z", "2026-08-13T01:00:35.000Z"]);
});

test("scheduler does not overlap drain runs", async () => {
  const workerSource = readFileSync(new URL("./domain-event-worker.ts", import.meta.url), "utf8");
  assert.match(workerSource, /let running = false/);
  assert.match(workerSource, /if \(running\) return/);
  assert.match(workerSource, /\.finally\(\(\) => \{ running = false; \}\)/);
});

test("domain event schema and repository support leased atomic claims", () => {
  const modelSource = readFileSync(new URL("./domain-event.model.ts", import.meta.url), "utf8");
  const workerSource = readFileSync(new URL("./domain-event-worker.ts", import.meta.url), "utf8");
  assert.match(modelSource, /"processing"/);
  assert.match(modelSource, /leaseUntil/);
  assert.match(modelSource, /claimToken/);
  assert.match(modelSource, /"deliveries\.leaseUntil"/);
  assert.match(workerSource, /findOneAndUpdate/);
  assert.match(workerSource, /\$elemMatch/);
  assert.match(workerSource, /deliveries\.\$\.leaseUntil/);
  assert.match(workerSource, /deliveries\.\$\.claimToken/);
});

test("server starts the domain event worker after connecting to MongoDB", () => {
  const source = readFileSync(new URL("../../../server.ts", import.meta.url), "utf8");
  assert.match(source, /import \{ startDomainEventWorker \} from "\.\/server\/integrations\/shared\/domain-event-worker"/);
  const connectedAt = source.indexOf("await connectDB()");
  const workerAt = source.indexOf("startDomainEventWorker()", connectedAt);
  assert.ok(connectedAt >= 0, "database startup missing");
  assert.ok(workerAt > connectedAt, "domain event worker must start after the database connects");
});
