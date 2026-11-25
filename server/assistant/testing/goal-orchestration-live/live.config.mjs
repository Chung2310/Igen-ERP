import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
export default defineConfig({ root, envDir: fileURLToPath(new URL('.', import.meta.url)),
  test: { environment: 'node', include: ['server/assistant/testing/goal-orchestration-live/*.live.ts'],
    setupFiles: ['server/assistant/testing/worker-live-preview-v2/safety.setup.mjs'],
    pool: 'forks', maxWorkers: 1, fileParallelism: false, testTimeout: 90000, hookTimeout: 30000 } });
