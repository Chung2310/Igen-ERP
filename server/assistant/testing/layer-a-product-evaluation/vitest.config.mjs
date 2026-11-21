import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../../../../', import.meta.url));
export default defineConfig({
  root, envDir: directory, resolve: { alias: { '@': root } },
  test: {
    environment: 'node', include: ['server/assistant/testing/layer-a-product-evaluation/*.test.mjs'],
    setupFiles: ['server/assistant/testing/layer-b-product-audit/safety.setup.mjs'],
    pool: 'forks', fileParallelism: false, maxWorkers: 1, testTimeout: 15000, hookTimeout: 15000,
  },
});
