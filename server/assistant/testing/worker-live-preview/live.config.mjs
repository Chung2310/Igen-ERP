import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
export default defineConfig({ root, envDir: fileURLToPath(new URL('.', import.meta.url)), resolve: { alias: { '@': root } },
  test: { environment: 'node', include: ['server/assistant/testing/worker-live-preview/*.live.ts'], setupFiles: ['server/assistant/testing/worker-live-preview/safety.setup.mjs'],
    pool: 'forks', fileParallelism: false, maxWorkers: 1, testTimeout: 150000, hookTimeout: 30000 } });
