import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  observeAssistantTurn, observeAssistantOwner, observeAssistantOperation,
  observeAssistantDispatch, observeAssistantFetch, observeAssistantBudgetCharge,
} from '../../call-observer.ts';
import { ExecutionBudget, PlanStoppedError } from '../../execution-budget.ts';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('ASSISTANT_CALL_OBSERVATION', 'true');
});
afterEach(() => vi.unstubAllEnvs());
const product = { id: 'inventory.product.detail', method: 'GET' };
const fixture = () => Promise.resolve(new Response('{}', { status: 200 }));

it.each(['sync', 'async'])('P3 %s sink failures preserve the exact business result and send once', async kind => {
  const result = { unchanged: true };
  const work = vi.fn(async () => result);
  const sink = kind === 'sync' ? () => { throw new Error('Telemetry sink failed'); } : async () => { throw new Error('Telemetry sink failed'); };
  expect(await observeAssistantTurn(work, sink)).toBe(result);
  expect(work).toHaveBeenCalledTimes(1);
});

it('P3 failed telemetry preserves the original business exception', async () => {
  const failure = new Error('Original business failure');
  await expect(observeAssistantTurn(async () => { throw failure; }, () => { throw new Error('Sink'); })).rejects.toBe(failure);
});

it('P3 transport rejection is distinct from a received HTTP error response', async () => {
  let summary;
  const failure = new Error('Fixture network unavailable');
  await observeAssistantTurn(async () => {
    const response = await observeAssistantFetch(product, () => Promise.resolve(new Response('{}', { status: 422 })));
    expect(response.status).toBe(422);
    await expect(observeAssistantFetch(product, () => Promise.reject(failure))).rejects.toBe(failure);
  }, row => { summary = row; });
  expect(summary.fetchInvocations).toBe(2);
  expect(summary.responsesReceived).toBe(1);
  expect(summary.transportErrors).toBe(1);
  expect(summary.events.map(event => [event.status, event.outcome])).toEqual([[422, 'response'], [null, 'transport_error']]);
});

it('P3 keeps metadata bounded while counting all300 transport invocations', async () => {
  let summary;
  await observeAssistantTurn(async () => {
    for (let index = 0; index < 300; index++) await observeAssistantOperation(() => observeAssistantFetch(product, fixture));
  }, row => { summary = row; });
  expect(summary.fetchInvocations).toBe(300);
  expect(summary.responsesReceived).toBe(300);
  expect(summary.events).toHaveLength(256);
  expect(summary.droppedEvents).toBe(44);
});

it('P3 isolates concurrent turns and preserves parent operation attribution', async () => {
  const summaries = [];
  await Promise.all(['product.list', 'inventory.product.detail'].map(owner => observeAssistantTurn(
    () => observeAssistantOwner(owner, 'prepare', () => observeAssistantOperation(
      () => observeAssistantOperation(() => observeAssistantFetch({ id: owner, method: 'GET' }, fixture)),
    )), row => { summaries.push(row); },
  )));
  expect(summaries).toHaveLength(2);
  for (const summary of summaries) {
    expect(summary.fetchInvocations).toBe(1);
    expect(summary.operationInvocations).toBe(2);
    expect(summary.events[0].parentCall).toBe(1);
    expect(summary.events[0].call).toBe(2);
    expect(summary.events[0].actualAction).toBe(summary.events[0].ownerAction);
  }
});

it('P3 counts calls without owner context as unknown and does not label every GET pure read', async () => {
  let summary;
  await observeAssistantTurn(async () => {
    await observeAssistantFetch({ id: 'unknown.review', method: 'GET' }, fixture);
    await observeAssistantFetch({ id: 'fixture.create', method: 'POST' }, fixture);
    await observeAssistantFetch({ id: 'fixture.report', method: 'POST', readOnly: true }, fixture);
  }, row => { summary = row; });
  expect(summary.unknownOwners).toBe(3);
  expect(summary.unknownPurposes).toBe(3);
  expect(summary.events.map(row => row.classification)).toEqual(['unreviewed', 'mutation', 'unreviewed']);
  expect(summary.readFetches).toBe(1);
  expect(summary.mutationFetches).toBe(1);
  expect(summary.unreviewedFetches).toBe(2);
});

it('P3 metadata does not contain payloads, record IDs or credentials', async () => {
  let summary;
  const privatePayload = { target: '65aa00000000000000000001', token: 'fixture-secret', productName: 'Private fixture name' };
  await observeAssistantTurn(() => observeAssistantOwner(product.id, 'execute', () => observeAssistantDispatch(
    () => observeAssistantOperation(() => observeAssistantFetch(product, async () => new Response(JSON.stringify(privatePayload)))),
  )), row => { summary = row; });
  for (const value of Object.values(privatePayload)) expect(JSON.stringify(summary)).not.toContain(value);
});

it.each(['production', 'staging', undefined])('P3 is disabled for environment %s', async environment => {
  vi.stubEnv('NODE_ENV', environment);
  const sink = vi.fn();
  await observeAssistantTurn(() => observeAssistantFetch(product, fixture), sink);
  expect(sink).not.toHaveBeenCalled();
});

it('P3 defaults off and does not emit a summary when the flag is absent', async () => {
  vi.stubEnv('ASSISTANT_CALL_OBSERVATION', undefined);
  const sink = vi.fn();
  await observeAssistantTurn(() => observeAssistantFetch(product, fixture), sink);
  expect(sink).not.toHaveBeenCalled();
});

it.each([false, true])('P3 leaves the existing24-read budget unchanged when observer=%s', async enabled => {
  vi.stubEnv('ASSISTANT_CALL_OBSERVATION', enabled ? 'true' : 'false');
  let summary;
  let sent = 0;
  const budget = new ExecutionBudget();
  await observeAssistantTurn(async () => {
    for (let index = 0; index < 24; index++) {
      budget.beforeCall(product.id, { index }, true);
      observeAssistantBudgetCharge(true);
      await observeAssistantFetch(product, async () => { sent++; return fixture(); });
    }
    expect(() => budget.beforeCall(product.id, { index: 24 }, true)).toThrow(PlanStoppedError);
  }, row => { summary = row; });
  expect(sent).toBe(24);
  expect(budget.reads).toBe(24);
  if (enabled) { expect(summary.chargedReads).toBe(24); expect(summary.readFetches).toBe(24); }
  else expect(summary).toBeUndefined();
});

it('P3 records interleaved local observer overhead without assuming production latency', async () => {
  const response = new Response('{}');
  const batchSize = 25;
  const samples = [];
  const one = () => observeAssistantTurn(() => observeAssistantOwner(product.id, 'execute', () =>
    observeAssistantDispatch(() => observeAssistantOperation(() => observeAssistantFetch(product, async () => response))),
  ), () => {});
  for (let warmup = 0; warmup < 100; warmup++) {
    vi.stubEnv('ASSISTANT_CALL_OBSERVATION', warmup % 2 ? 'true' : 'false');
    await one();
  }
  for (let round = 0; round < 40; round++) {
    const result = {};
    for (const enabled of round % 2 ? [true, false] : [false, true]) {
      vi.stubEnv('ASSISTANT_CALL_OBSERVATION', enabled ? 'true' : 'false');
      const start = performance.now();
      for (let index = 0; index < batchSize; index++) expect(await one()).toBe(response);
      result[enabled ? 'onMsPerTurn' : 'offMsPerTurn'] = (performance.now() - start) / batchSize;
    }
    samples.push({ ...result, deltaMsPerTurn: result.onMsPerTurn - result.offMsPerTurn });
  }
  const percentile = (data, fraction) => [...data].sort((a, b) => a - b)[Math.ceil(data.length * fraction) - 1];
  writeFileSync(new URL('./p3-observer-overhead.json', import.meta.url), JSON.stringify({
    method: '100 warmup turns;40 interleaved pairs;25 fake-response turns per batch;noop sink;no HTTP/DB/model',
    samples, medianOffMs: percentile(samples.map(row => row.offMsPerTurn), .5),
    medianOnMs: percentile(samples.map(row => row.onMsPerTurn), .5),
    medianPairedDeltaMs: percentile(samples.map(row => row.deltaMsPerTurn), .5),
    p95PairedDeltaMs: percentile(samples.map(row => row.deltaMsPerTurn), .95),
  }, null, 2) + '\n');
});
