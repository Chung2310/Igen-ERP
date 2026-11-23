import { readFileSync, writeFileSync } from 'node:fs';

const evidence = JSON.parse(readFileSync(new URL('./p3-observations.json', import.meta.url), 'utf8'));
const rows = evidence.scenarios;
// Same19 conversation scenarios in both C modes. Exclude helpers, guard tests,
// forced-default-off controls and C-only negative tests from the distribution.
const names = new Set(rows.filter(row => !row.exactVerify && !row.observer && row.turns.length
  && !row.scenario.startsWith('P2 flag is off')).map(row => row.scenario));
const sum = values => values.reduce((n, value) => n + value, 0);
const histogram = values => Object.fromEntries([...new Set(values)].sort((a, b) => a - b)
  .map(value => [value, values.filter(item => item === value).length]));
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
const statistics = values => ({ n: values.length, histogram: histogram(values), p50: percentile(values, .5), p95: percentile(values, .95), max: Math.max(...values) });
const cohorts = [false, true].map(exactVerify => {
  const cohort = rows.filter(row => row.observer && row.exactVerify === exactVerify && names.has(row.scenario));
  const observations = cohort.flatMap(row => row.observations);
  const events = observations.flatMap(row => row.events);
  const timing = observer => {
    const times = rows.filter(row => row.observer === observer && row.exactVerify === exactVerify && names.has(row.scenario))
      .flatMap(row => row.turnDurations.map(turn => turn.elapsedMs));
    return { n: times.length, p50Ms: percentile(times, .5), p95Ms: percentile(times, .95) };
  };
  return {
    exactVerify, scenarioCount: cohort.length, turnCount: observations.length,
    physicalReadFetches: sum(observations.map(row => row.readFetches)),
    chargedReads: sum(observations.map(row => row.chargedReads)),
    perTurn: statistics(observations.map(row => row.readFetches)),
    perScenario: statistics(cohort.map(row => sum(row.observations.map(turn => turn.readFetches)))),
    unknownOwners: sum(observations.map(row => row.unknownOwners)),
    unknownPurposes: sum(observations.map(row => row.unknownPurposes)),
    unreviewedFetches: sum(observations.map(row => row.unreviewedFetches)),
    droppedEvents: sum(observations.map(row => row.droppedEvents)),
    purposes: Object.fromEntries(['primary', 'reference', 'verification', 'unknown'].map(purpose => [purpose, events.filter(event => event.purpose === purpose).length])),
    persistenceMock: { turnCreates: sum(cohort.map(row => row.turnCreateCount)), turnUpdates: sum(cohort.map(row => row.journalWriteCount)), sessionWrites: sum(cohort.map(row => row.sessionWriteCount)) },
    timing: { observerOff: timing(false), observerOn: timing(true), caveat: 'Single fixture run in fixed cohort order;JIT/cache noise;not observer speedup or production latency' },
    scenarios: cohort.map(row => ({ scenario: row.scenario, perTurnReads: row.observations.map(turn => turn.readFetches),
      perTurnCharged: row.observations.map(turn => turn.chargedReads), statuses: row.replies.map(reply => reply.status) })),
  };
});
const result = { generatedAt: evidence.generatedAt, method: '19 shared synthetic conversation scenarios;nearest-rank percentiles;zero-read turns included', cohorts };
writeFileSync(new URL('./p3-distribution.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
for (const cohort of cohorts) console.log(JSON.stringify({ exactVerify: cohort.exactVerify, scenarios: cohort.scenarioCount,
  turns: cohort.turnCount, reads: cohort.physicalReadFetches, charged: cohort.chargedReads, perTurn: cohort.perTurn }));
