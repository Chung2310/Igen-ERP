import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
export default defineConfig({
  root, envDir: fileURLToPath(new URL('.', import.meta.url)), resolve: { alias: { '@': root } },
  test: {
    include: ['src/components/common/AssistantMissingInfoForm.test.tsx', 'src/components/common/StyledSelect.test.tsx', 'src/components/common/ChatbotWidget.welcome.test.tsx'],
    pool: 'forks', fileParallelism: false, maxWorkers: 1, testTimeout: 15000,
  },
});
