// Whole-app evidence inventory. A passing mock is never business acceptance.
// Refresh tmp/app-operation-inventory.json from the runtime catalog before use.
const fs = require('node:fs');
const catalog = JSON.parse(fs.readFileSync('tmp/app-operation-inventory.json', 'utf8'));
const routes = JSON.parse(fs.readFileSync('server/assistant/coverage.generated.json', 'utf8'));
const results = JSON.parse(fs.readFileSync('tmp/readiness-final-verified.json', 'utf8'));
const matrix = results.testResults.filter(s => /function-conversation-matrix\.test\.ts$/.test(s.name))
  .flatMap(s => s.assertionResults);
const operations = catalog.map(op => {
  const tests = matrix.filter(t => t.fullName.startsWith(op.id + ' '));
  return { id: op.id, module: op.module, title: op.title, method: op.method, path: op.path,
    unavailableReason: op.unavailableReason || null,
    mockConversationCases: tests.length,
    mockSuccess: tests.some(t => t.fullName === op.id + ' success-probe' && t.status === 'passed'),
    failures: tests.filter(t => t.status !== 'passed').map(t => t.fullName),
    businessAcceptance: 'unreviewed',
    gaps: ['Per-function business scenarios and invariants need reviewed evidence',
      'Real model understanding is not verified', 'Full authenticated execution is not verified'] };
});
const modules = [...new Set(operations.map(o => o.module))].map(module => {
  const rows = operations.filter(o => o.module === module);
  return { module, registered: rows.length, unavailable: rows.filter(o => o.unavailableReason).length,
    mockSuccess: rows.filter(o => o.mockSuccess).length,
    outsideExistingConversationMatrix: rows.filter(o => !o.mockConversationCases).length,
    businessAcceptancePercent: null };
});
const report = { generatedAt: new Date().toISOString(), scope: 'All application business functionality',
  overallReadinessPercent: null, targetPercent: [80, 90], targetMet: false,
  rules: [
    'Student 37/44 criteria must not be extrapolated to the application.',
    'Catalog operations and API routes are inventory, not the final business-function denominator.',
    'Deferred modules remain visible and unverified. They cannot be silently removed from whole-app coverage.',
    'Aliases, authentication and device flows need explicit classification before a business denominator is finalized.',
    'Each business function needs success, invalid/missing data, permission/branch boundaries, and applicable state-transition evidence.',
    'Writes additionally require confirmation, cancellation, retry/duplicate and read-back evidence.',
    'Technical offline evidence and real model language accuracy must be reported separately.'
  ], modules, operations,
  routesAwaitingClassification: routes.entries.filter(r => !['contract', 'manual'].includes(r.status)),
  routeInventorySource: 'server/assistant/coverage.generated.json (snapshot, not fresh route discovery)',
  nextWork: modules.filter(m => m.outsideExistingConversationMatrix).map(m => ({ module: m.module,
    action: 'Review business scope and add meaningful scenarios before claiming coverage' })) };
fs.writeFileSync('tmp/assistant-app-readiness.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ overallReadinessPercent: null, targetMet: false, modules,
  routesAwaitingClassification: report.routesAwaitingClassification.length }, null, 2));
