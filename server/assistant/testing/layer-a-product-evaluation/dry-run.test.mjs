import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { CASES, CORPUS_VERSION } from './corpus-s-v1.mjs';
import { interpretRequest } from '../../semantic-interpreter.ts';
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from '../../catalog.ts';
import { ERP_LLM_MODEL } from '../../../../shared/llm-model.ts';

const wireCalls = [];
const runs = [];
const blockedAttempts = [];
let current;
let discovery;
let refuseWire;
let guard;
let logs;
const providerEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
const fakeKey = 'fixture-not-a-real-provider-key';
const narrow = () => ['product.list', 'inventory.product.detail'].map(id => defaultWorkflow(operationById(id)));
// Synthetic all-metadata profile. No real user's permissions/settings/DB are read.
const productionShaped = () => ASSISTANT_OPERATIONS.map(defaultWorkflow).filter(workflow => workflow.enabled);
const isDiscovery = body => body.messages[0].content.startsWith('Khám phá công cụ ERP');
const mainWorkflows = body => {
  const line = body.messages[0].content.split('\n').find(line => line.startsWith('DANH MỤC: '));
  return line ? JSON.parse(line.slice('DANH MỤC: '.length)) : null;
};
beforeEach(() => {
  vi.stubEnv('OPENROUTER_API_KEY', fakeKey);
  vi.stubEnv('CHATBOT_MODEL', 'google/gemini-2.5-flash');
  vi.stubEnv('OPENROUTER_MODEL', 'google/gemini-2.5-flash');
  vi.stubEnv('OPENROUTER_FALLBACK_MODEL', 'google/gemini-2.5-flash');
  for (const name of ['FREELLM_API_URL', 'FREELLM_API_KEY', 'OPENROUTER_MAX_TOKENS']) vi.stubEnv(name, undefined);
  current = null; discovery = { modules: ['inventory'] }; refuseWire = false;
  guard = globalThis.fetch;
  globalThis.__layerBProductSafety.violations.length = 0;
  logs = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('fetch', async (url, init = {}) => {
    // This branch only constructs a fixture Response. There is no native-fetch escape hatch.
    if (String(url) !== providerEndpoint || init.method !== 'POST') return guard(url, init);
    expect(init.headers.Authorization).toBe(`Bearer ${fakeKey}`);
    const body = JSON.parse(init.body);
    expect(body.model).toBe(ERP_LLM_MODEL);
    expect(body).not.toHaveProperty('temperature');
    if (refuseWire) {
      blockedAttempts.push({ caseId: 'CONTROL-ZERO-BUDGET', reason: 'DRY_RUN_TRANSPORT_DISABLED' });
      throw Object.assign(new Error('DRY_RUN_TRANSPORT_DISABLED'), { status: 401 });
    }
    const stage = isDiscovery(body) ? 'discovery' : 'interpretation';
    const response = stage === 'discovery' ? discovery : current.scripted;
    const publicBody = { ...body };
    wireCalls.push({ caseId: current?.id || 'control', stage, body: publicBody,
      bodyBytes: Buffer.byteLength(init.body), bodySha256: createHash('sha256').update(init.body).digest('hex') });
    return Response.json({ choices: [{ message: { content: JSON.stringify(response) } }], model: body.model });
  });
});
afterEach(() => {
  logs.mockRestore();
  expect(globalThis.__layerBProductSafety.violations).toEqual([]);
  vi.unstubAllEnvs();
  vi.stubGlobal('fetch', guard);
});
afterAll(() => {
  const selected = runs.filter(run => run.caseId.startsWith('S'));
  const profiles = ['CAT-NARROW', 'CAT-PRODUCTION-SHAPED'].map(profile => {
    const cohort = selected.filter(run => run.profile === profile);
    const sizes = cohort.flatMap(run => run.calls.map(call => call.bodyBytes));
    return { profile, cases: cohort.length, workflowCount: cohort[0]?.workflowCount,
      mockRequests: cohort.reduce((n, run) => n + run.calls.length, 0),
      discoveryRequests: cohort.flatMap(run => run.calls).filter(call => call.stage === 'discovery').length,
      requestBodyBytes: { min: Math.min(...sizes), max: Math.max(...sizes), total: sizes.reduce((n, size) => n + size, 0) },
      excludedFromFutureFullCatalogExactScoring: profile === 'CAT-PRODUCTION-SHAPED' ? ['S18', 'S19', 'S20'] : [],
    };
  });
  const compact = call => ({ caseId: call.caseId, stage: call.stage, bodyBytes: call.bodyBytes, bodySha256: call.bodySha256,
    model: call.body.model, maxTokens: call.body.max_tokens ?? null, responseFormat: call.body.response_format,
    candidateCount: mainWorkflows(call.body)?.length ?? null });
  writeFileSync(new URL('./luna-dry-run-prompt-snapshots.json', import.meta.url), JSON.stringify(runs
    .filter(run => ['S01', 'S21', 'S22', 'S24', 'CONTROL-DISCOVERY-FALLBACK'].includes(run.caseId))
    .map(run => ({ caseId: run.caseId, profile: run.profile, calls: run.calls })), null, 2) + '\n');
  const labelDocument = readFileSync(new URL('../../../../docs/phieu-duyet-48-ca-tro-ly-erp.md', import.meta.url), 'utf8');
  const approvedRows = labelDocument.split('\n').filter(line => /^\| S\d{2} \|/.test(line));
  writeFileSync(new URL('./p5-luna-label-lock.json', import.meta.url), JSON.stringify({
    version: CORPUS_VERSION, approvedBy: 'User in this conversation,2026-11-21',
    approvedDecisions: ['D1', 'D2', 'D3', 'D4', 'D5'], approvedCaseIds: CASES.map(item => item.id),
    pendingGroups: ['O01-O16', 'F01-F08', 'D6'], liveAllowed: false, budgetUSD: 0,
    source: 'docs/phieu-duyet-48-ca-tro-ly-erp.md', approvedRows,
    labelsSha256: createHash('sha256').update(approvedRows.join('\n')).digest('hex'),
    scriptedRepliesAreGroundTruthForAccuracy: false,
    sources: Object.fromEntries(['semantic-interpreter.ts', '../service/openrouter.service.ts', 'catalog.ts'].map(name => {
      const path = new URL(`../../${name}`, import.meta.url);
      return [name, createHash('sha256').update(readFileSync(path)).digest('hex')];
    })),
  }, null, 2) + '\n');
  writeFileSync(new URL('./luna-dry-run-observations.json', import.meta.url), JSON.stringify({
    generatedAt: new Date().toISOString(), mode: 'offline-scripted-provider', model: ERP_LLM_MODEL, corpusVersion: CORPUS_VERSION,
    liveProviderRequests: 0, realBusinessRequests: 0, realDatabaseConnections: 0, budgetUSD: 0,
    modelAccuracy: null, actualProviderTokens: null, actualProviderCost: null,
    usageNote: 'Mock Responses omit usage;request bytes are not token counts or a cost estimate.',
    fixtureProviderResponses: wireCalls.length, blockedAttempts,
    profiles, runs: runs.map(run => ({ ...run, calls: run.calls.map(compact) })),
  }, null, 2) + '\n');
});

describe.each(['CAT-NARROW', 'CAT-PRODUCTION-SHAPED'])('P5 offline prompt plumbing %s', profile => {
  it.each(CASES)('$id keeps the approved public fixture and captures the actual provider wire prompt', async item => {
    current = item;
    const workflows = profile === 'CAT-NARROW' ? narrow() : productionShaped();
    const start = wireCalls.length;
    const started = performance.now();
    const result = await interpretRequest(item.text, workflows, item.pending || null, item.messages || [], '', [], '', ['inventory']);
    const calls = wireCalls.slice(start);
    const expanded = profile === 'CAT-PRODUCTION-SHAPED'
      && ['ambiguous', 'unsupported'].includes(item.scripted.intentType) && !item.scripted.cancel;
    expect(calls.map(call => call.stage)).toEqual(profile === 'CAT-NARROW' ? ['interpretation']
      : expanded ? ['discovery', 'interpretation', 'interpretation'] : ['discovery', 'interpretation']);
    expect(result.actionId).toBe(item.scripted.actionId);
    expect(result.values).toEqual(item.scripted.values);
    if (item.id === 'S24') expect(result.cancel).toBe(true);
    const wire = calls.at(-1).body;
    expect(wire.response_format).toEqual({ type: 'json_object' });
    // Main interpretation currently requests JSON mode without a responseSchema.
    expect(wire.messages[0].content.includes('Respond ONLY with a valid JSON object')).toBe(false);
    const candidates = mainWorkflows(wire);
    expect(candidates.some(workflow => workflow.actionId === 'product.list')).toBe(true);
    expect(candidates.some(workflow => workflow.actionId === 'inventory.product.detail')).toBe(true);
    if (profile === 'CAT-PRODUCTION-SHAPED') {
      expect(calls[0].body.messages[0].content.includes('Respond ONLY with a valid JSON object')).toBe(true);
      expect(candidates.length).toBe(expanded ? workflows.length : workflows.filter(workflow => workflow.module === 'inventory').length);
    }
    expect(wire.messages.at(-1).content).toContain(item.text);
    expect(JSON.stringify(wire)).not.toContain(fakeKey);
    expect(JSON.stringify(wire)).not.toMatch(/65aa[0-9a-f]{20}/i);
    if (item.id === 'S21') expect(wire.messages[0].content).toContain('Điện thoại Mây A1');
    if (item.id === 'S22') {
      expect(wire.messages[0].content).toContain('SP-SONG-DEN');
      expect(wire.messages[0].content).toContain('SP-SONG-TRANG');
    }
    runs.push({ caseId: item.id, profile, workflowCount: workflows.length,
      result, calls, fullCatalogExactLabel: item.fullCatalogExactLabel || 'approved-slice-only',
      elapsedMs: performance.now() - started, outcome: 'offline-contract-check-only' });
  });
});

it('P5 dry-run has24 unique approved S IDs and no O/F cases', () => {
  expect(CASES.map(item => item.id)).toEqual(Array.from({ length: 24 }, (_, index) => `S${String(index + 1).padStart(2, '0')}`));
  expect(new Set(CASES.map(item => item.id)).size).toBe(24);
  const document = readFileSync(new URL('../../../../docs/phieu-duyet-48-ca-tro-ly-erp.md', import.meta.url), 'utf8');
  const approvedIds = [...document.matchAll(/^\| (S\d{2}) \|/gm)].map(match => match[1]);
  expect(approvedIds).toEqual(CASES.map(item => item.id));
});

it('P5 zero-budget transport refusal stops before any fixture response;no real fallback provider', async () => {
  current = CASES[0]; refuseWire = true;
  const start = wireCalls.length;
  await expect(interpretRequest(current.text, narrow(), null, [])).rejects.toThrow('DRY_RUN_TRANSPORT_DISABLED');
  expect(wireCalls).toHaveLength(start);
});

it('P5 discovery errors retain the production fallback to the full catalog', async () => {
  current = CASES[0]; discovery = { modules: ['not-a-real-module'] };
  const start = wireCalls.length;
  const result = await interpretRequest(current.text, productionShaped(), null, []);
  expect(result.actionId).toBe('product.list');
  runs.push({ caseId: 'CONTROL-DISCOVERY-FALLBACK', profile: 'control', calls: wireCalls.slice(start), result });
  expect(wireCalls.slice(start).map(call => call.stage)).toEqual(['discovery', 'interpretation']);
  expect(mainWorkflows(wireCalls.at(-1).body)).toHaveLength(productionShaped().length);
});

it('P5 rejects an action outside the narrow allowed catalog after provider interpretation', async () => {
  current = { id: 'CONTROL-OUTSIDE-ACTION', text: 'Tìm sản phẩm', scripted: { actionId: 'employee.create', values: {}, intentType: 'workflow' } };
  const start = wireCalls.length;
  await expect(interpretRequest(current.text, narrow(), null, [])).rejects.toThrow('ngoài danh mục');
  runs.push({ caseId: current.id, profile: 'control', calls: wireCalls.slice(start), outcome: 'rejected-outside-catalog' });
});
