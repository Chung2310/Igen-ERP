import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve('tmp/local-qa');
const json = async name => JSON.parse(await readFile(path.join(directory, name), 'utf8'));
const seed = await json('seed-report.json');
const vitest = await json('vitest-report.json');
const nodeLog = await readFile(path.join(directory, 'node-regression.log'), 'utf8');
const smoke = await json('smoke-report.json');
const browser = await json('browser-report.json');
const nodeCount = name => Number(nodeLog.match(new RegExp(`ℹ ${name} (\\d+)`))?.[1] || 0);
const failedVitest = vitest.testResults.filter(file => file.status === 'failed').map(file => ({ file: path.relative(process.cwd(), file.name), failures: file.assertionResults.filter(test => test.status === 'failed').map(test => ({ name: test.fullName, messages: test.failureMessages })) }));
const summary = {
  generatedAt: new Date().toISOString(),
  environment: { url: 'http://127.0.0.1:3120', database: 'igen_qa_local', credentials: 'tmp/local-qa/access.json' },
  seed: { records: seed.records, accounts: seed.accounts, modules: seed.modules, errors: seed.errors },
  vitest: { total: vitest.numTotalTests, passed: vitest.numPassedTests, failed: vitest.numFailedTests, skipped: vitest.numPendingTests, failures: failedVitest },
  node: { total: nodeCount('tests'), passed: nodeCount('pass'), failed: nodeCount('fail'), failures: [...new Set(nodeLog.split('\n').filter(line => line.startsWith('✖') && !line.includes('failing tests:')))] },
  api: { total: smoke.length, passed: smoke.filter(test => test.passed).length, failures: smoke.filter(test => !test.passed) },
  browser: browser.map(({ text: _text, ...entry }) => entry),
  limitations: [
    'Representative fixtures cover 13 modules, not every possible workflow or state.',
    'Draft retail orders have not been confirmed; payment, inventory posting, invoice export and external integrations require additional end-to-end checks.',
    'The local harness does not start Socket.IO or normal application background workers; socket connection failures are expected here.',
    'Dark-mode secondary text in the activity monitor has low contrast; screenshots preserve this finding.',
    'Broad test failures have not all been triaged. They include assertion differences, incomplete test mocks, timeouts and Windows Node/libuv process failures. Do not interpret all as verified product defects.',
    'Browser route checks and screenshots do not prove all create/update/delete flows work.',
    'The /quan-ly-ung-vien route rendered the overview in the browser run; recruitment must also be checked through the HR recruitment tab.',
  ],
};
await writeFile(path.join(directory, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ seedRecords: seed.records, apiPassed: summary.api.passed, vitestPassed: summary.vitest.passed, vitestFailed: summary.vitest.failed, nodePassed: summary.node.passed, nodeFailed: summary.node.failed, browserChecks: browser.length }));
