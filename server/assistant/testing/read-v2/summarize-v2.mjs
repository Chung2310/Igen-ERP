import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const reports = Object.fromEntries([
  ['v2', 'vitest-results.json'], ['p6', 'p6-regression-results.json'], ['p3', 'p3-regression-results.json'],
  ['llm', 'llm-regression-results.json'], ['shared', 'shared-regression-results.json'], ['p5Offline', 'p5-offline-regression-results.json'],
].map(([name, file]) => {
  const report = read(file);
  assert.equal(report.numFailedTests, 0, file);
  assert.equal(report.numPendingTests, 0, file);
  return [name, { passed: report.numPassedTests, failed: report.numFailedTests }];
}));
const evidence = read('v2-observations.json');
const ids = new Map([['65aa00000000000000000001', 'P1'], ['65aa00000000000000000002', 'P2'], ['65aa00000000000000000003', 'P3'], ['65aa00000000000000000004', 'P4'], ['65aa00000000000000000005', 'P5']]);
const scenarios = evidence.scenarios.map(row => {
  assert.deepEqual(row.violations, [], row.scenario);
  assert(row.calls.every(call => call.method === 'GET'), row.scenario);
  assert(!/65aa|65bb|66cc|tokenHash|replyTokens/.test(JSON.stringify(row.modelInputs || [])), row.scenario);
  assert(!/65aa|65bb|66cc|tokenHash|replyTokens/.test(JSON.stringify(row.replies)), row.scenario);
  const journal = row.turns.flatMap(turn => turn.businessCallJournal?.calls || []);
  return {
    scenario: row.scenario, userCalls: row.replies.length, uniqueTurns: row.turns.length,
    scriptedModelInterpretations: (row.modelInputs || []).length,
    physicalGETs: row.calls.length, chargedReads: row.budgets.reduce((n, budget) => n + budget.reads, 0),
    completedSteps: row.turns.flatMap(turn => turn.steps || []).filter(step => step.status === 'completed').length,
    statuses: row.replies.map(reply => reply.status),
    detailTargets: row.calls.filter(call => call.kind === 'detail').map(call => ids.get(call.target) || 'fixture-other'),
    transport: row.calls.map(call => ({ kind: call.kind, status: call.status })),
    journalEntries: journal.length, turnUpdatesMock: row.journalWriteCount, sessionWritesMock: row.sessionWriteCount,
  };
});
const runtimeFiles = [
  'server/assistant/read-v2-contract.ts', 'server/assistant/read-v2-runtime.ts', 'server/assistant/read-v2-service.ts',
  'server/assistant/read-v2-cache.ts', 'server/assistant/read-v2-retention.ts', 'server/assistant/semantic-read-v2.ts',
  'server/assistant/service.ts', 'server/assistant/router.ts', 'server/assistant/models.ts', 'server/assistant/execution-budget.ts',
  'server/assistant/business-call-gate.ts', 'server/assistant/product-read-prototype.ts',
];
const hashes = Object.fromEntries(runtimeFiles.map(path => [path, createHash('sha256').update(readFileSync(new URL('../../../../' + path, import.meta.url))).digest('hex')]));
assert.equal(hashes['server/assistant/execution-budget.ts'], '440627bceee07157191f6c93d12adb846b96434398d6b59c3e0ea28edf06ecd7');
const result = {
  generatedAt: evidence.generatedAt, scope: ['product.list', 'inventory.product.detail'],
  transport: 'direct-only', accounting: 'legacy_primary', readCap: 24,
  modelCallsAreMocked: true, realModelRequests: 0, realBusinessRequests: 0, realDatabaseRequests: 0,
  reports, totalTestInstances: Object.values(reports).reduce((sum, report) => sum + report.passed, 0),
  method: 'Actual V2 schemas/interpreter/adapter/service/dispatch/completion;scripted provider output and in-memory persistence/auth/business transport;native wire and router tested separately with mocks.',
  caveats: ['No model accuracy, provider token usage/cost/latency or actual database latency has been measured.',
    'Scenario counters include preflight reads and explicit negative cases;do not treat them as production traffic distribution.',
    'Turn updates/session writes count mocks;workflow/ACL/cache/retention sweeps are additional metadata work,not physical business HTTP.'],
  hashes, scenarios,
};
writeFileSync(new URL('./v2-summary.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ reports, totalTestInstances: result.totalTestInstances, fixtureScenarios: scenarios.length }, null, 2));
for (const prefix of ['V2 list quote', 'V2 exact target bypasses', 'V2 duplicate name selects', 'V2 screen context', 'V2 option TTL', 'V2 respects custom confirmation', 'V2 F101']) {
  for (const scenario of scenarios.filter(row => row.scenario.startsWith(prefix))) console.log(JSON.stringify(scenario));
}
