import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
export default defineConfig({
  root, envDir: fileURLToPath(new URL('.', import.meta.url)), resolve: { alias: { '@': root } },
  test: {
    environment: 'node',
    include: [
      'server/assistant/execution-budget.test.ts', 'server/assistant/api-rejection.test.ts',
      'server/assistant/reply-presentation.test.ts', 'server/assistant/result-format.test.ts',
      'server/assistant/reference-projection.test.ts', 'server/assistant/quotation-assistant.test.ts',
    ],
    setupFiles: ['server/assistant/testing/llm-model-migration/safety.setup.mjs'],
    pool: 'forks', fileParallelism: false, maxWorkers: 1, testTimeout: 15000, hookTimeout: 15000,
  },
});
