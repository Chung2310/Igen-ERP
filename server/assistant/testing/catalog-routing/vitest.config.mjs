import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
export default defineConfig({
  root,
  // Do not load the application's real provider/database environment.
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { alias: { '@': root } },
  test: {
    environment: 'node',
    include: [
      'server/assistant/partner-read-regression.test.ts',
      'server/assistant/goal-orchestration.test.ts',
      'server/assistant/semantic-routing-budget.test.ts',
      'server/assistant/read-relations.test.ts',
      'server/assistant/email-policy.test.ts',
      'server/assistant/result-format.test.ts',
      'server/assistant/list-analysis.test.ts',
      'server/assistant/operation-metadata.test.ts',
      'server/assistant/module-regression.test.ts',
      'server/assistant/tuition-debt.test.ts',
      'server/assistant/business-result.test.ts',
      'server/assistant/coverage-function-recovery.test.ts',
      'server/assistant/function-context.test.ts',
      'server/assistant/semantic-interpreter.test.ts',
      'server/assistant/request-coverage.test.ts',
      'server/assistant/module-context.test.ts',
      'server/assistant/module-scope.test.ts',
      'server/assistant/composite-query.test.ts',
      'server/assistant/legal-reference-conversation.test.ts',
      'server/assistant/worker-management-conversation.test.ts',
      'server/assistant/collection-form.test.ts',
      'server/assistant/business-discovery.test.ts',
      'server/assistant/audited-query-contracts.test.ts',
    ],
    setupFiles: ['server/assistant/testing/catalog-routing/safety.setup.mjs'],
    pool: 'forks', maxWorkers: 1, fileParallelism: false,
    testTimeout: 15000, hookTimeout: 30000,
  },
});
