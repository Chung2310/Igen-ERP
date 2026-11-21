import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
export default defineConfig({
  root, envDir: fileURLToPath(new URL('.', import.meta.url)), resolve: { alias: { '@': root } },
  test: {
    environment: 'node',
    include: [
      'server/assistant/testing/llm-model-migration/*.test.mjs',
      'server/service/openrouter.chat.test.ts',
      'server/service/openrouter.image.test.ts',
      'server/assistant/semantic-interpreter.test.ts',
      'server/assistant/attachment-values.test.ts',
      'server/assistant/studio-mindmaps.test.ts',
      'server/assistant/studio-images.test.ts',
      'server/assistant/studio-charts.test.ts',
      'server/assistant/studio-slides.test.ts',
      'server/assistant/assistant-visual-creation.test.ts',
      'server/modules/architect-assistant/models.test.ts',
      'server/modules/marketing-suite/shared/service/openrouter.chat-message.test.ts',
    ],
    setupFiles: ['server/assistant/testing/llm-model-migration/safety.setup.mjs'],
    pool: 'forks', fileParallelism: false, maxWorkers: 1, testTimeout: 15000, hookTimeout: 15000,
  },
});
