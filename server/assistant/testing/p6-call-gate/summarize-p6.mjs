import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const evidence = JSON.parse(readFileSync(new URL('./p6-observations.json', import.meta.url), 'utf8'));
const results = JSON.parse(readFileSync(new URL('./vitest-results.json', import.meta.url), 'utf8'));
assert.equal(results.numFailedTests, 0);
assert.equal(results.numPendingTests, 0);
const rows = evidence.scenarios;
// Same cohort selection as P3: shared conversation scenarios; exclude helper-only,
// deliberate safety probes, forced flag controls and C-only negative scenarios.
const names = new Set(rows.filter(row => !row.gate && !row.exactVerify && !row.observer && row.turns.length
  && !row.scenario.startsWith('P2 flag is off')).map(row => row.scenario));
assert.equal(names.size, 19);
const sum = values => values.reduce((n, value) => n + value, 0);
const histogram = values => Object.fromEntries([...new Set(values)].sort((a, b) => a - b)
  .map(value => [value, values.filter(item => item === value).length]));
const quantile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
const cohorts = [false, true].flatMap(exactVerify => [false, true].map(gate => {
  const cohort = rows.filter(row => row.gate === gate && row.observer && row.exactVerify === exactVerify && names.has(row.scenario));
  const observations = cohort.flatMap(row => row.observations);
  const values = observations.map(row => row.readFetches);
  assert.equal(cohort.length, 19);
  assert.equal(observations.length, 31);
  const entries = cohort.flatMap(row => row.turns.flatMap(turn => turn.businessCallJournal?.calls || []));
  const calls = sum(cohort.map(row => row.calls.length));
  assert.equal(calls, sum(values));
  assert.equal(entries.length, gate ? calls : 0);
  const persistence = {
    turnCreates: sum(cohort.map(row => row.turnCreateCount)),
    turnUpdates: sum(cohort.map(row => row.journalWriteCount)),
    sessionWrites: sum(cohort.map(row => row.sessionWriteCount)),
    callJournalWrites: sum(cohort.map(row => row.businessJournalWriteCount)),
    callJournalReads: sum(cohort.map(row => row.gateReadCount)),
    workflowLookupsMock: sum(cohort.map(row => row.workflowReadCount)),
  };
  assert.equal(persistence.callJournalWrites, gate ? 3 * calls : 0);
  return {
    exactVerify, gate, scenarioCount: cohort.length, turnCount: observations.length,
    physicalReads: calls, chargedReads: sum(observations.map(row => row.chargedReads)),
    perTurn: { histogram: histogram(values), p50: quantile(values, .5), p95: quantile(values, .95), max: Math.max(...values) },
    journalEntries: entries.length,
    journalPurposes: Object.fromEntries(['primary', 'reference', 'verification'].map(purpose => [purpose, entries.filter(call => call.purpose === purpose).length])),
    persistenceMock: persistence,
    timingMock: { p50Ms: quantile(cohort.flatMap(row => row.turnDurations.map(turn => turn.elapsedMs)), .5), p95Ms: quantile(cohort.flatMap(row => row.turnDurations.map(turn => turn.elapsedMs)), .95) },
  };
}));
for (const exactVerify of [false, true]) {
  const [off, on] = cohorts.filter(row => row.exactVerify === exactVerify);
  assert.equal(on.physicalReads, off.physicalReads);
  assert.equal(on.chargedReads, off.chargedReads);
  assert.deepEqual(on.perTurn, off.perTurn);
  assert.equal(on.persistenceMock.turnUpdates - off.persistenceMock.turnUpdates, on.persistenceMock.callJournalWrites);
  assert.equal(on.persistenceMock.workflowLookupsMock - off.persistenceMock.workflowLookupsMock, 2 * on.physicalReads);
}
const runtimeFiles = [
  'server/assistant/business-call-gate.ts', 'server/assistant/execution-control.ts',
  'server/assistant/service.ts', 'server/assistant/executor.ts', 'server/assistant/models.ts',
  'server/assistant/router.ts', 'server/assistant/semantic-interpreter.ts',
  'server/service/openrouter.service.ts', 'server/assistant/execution-budget.ts',
];
const sourceHashes = Object.fromEntries(runtimeFiles.map(path => [path, createHash('sha256').update(readFileSync(new URL('../../../../' + path, import.meta.url))).digest('hex')]));
const result = {
  generatedAt: evidence.generatedAt,
  method: '19 shared synthetic conversation scenarios;31 turns/cohort;nearest-rank;observer ON;gate/C toggled separately',
  accounting: 'legacy_primary', approvedReadCap: 24,
  verification: { passedTests: results.numPassedTests, failedTests: results.numFailedTests },
  caveats: [
    'No real model, network, business API, Redis or MongoDB access;all transport mocked and lower-level I/O guarded.',
    'Workflow lookups are function calls to a mock,not counts of actual ACL/MongoDB/Redis operations.',
    'Timing is one synthetic mock run,not production latency or evidence of a speedup.',
    'Journal prepared/sent marks durable intent;sent does not prove receipt by the remote API.',
  ],
  sourceHashes, cohorts,
};
writeFileSync(new URL('./p6-summary.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
