import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
export default defineConfig({
  root, envDir: fileURLToPath(new URL('.', import.meta.url)), resolve: { alias: { '@': root } },
  test: {
    environment: 'node',
    include: ['server/assistant/semantic-interpreter.test.ts', 'server/assistant/worker-management-conversation.test.ts', 'server/assistant/collection-form.test.ts', 'server/assistant/module-scope.test.ts'],
    setupFiles: ['server/assistant/testing/llm-model-migration/safety.setup.mjs'],
    pool: 'forks', fileParallelism: false, maxWorkers: 1, testTimeout: 15000, hookTimeout: 15000,
  },
});
