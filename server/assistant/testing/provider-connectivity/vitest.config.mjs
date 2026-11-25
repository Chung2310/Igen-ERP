import { defineConfig } from 'vitest/config';
import base from '../catalog-routing/vitest.config.mjs';
export default defineConfig({ ...base, test: { ...base.test, include: [
  'server/assistant/semantic-routing-budget.test.ts',
  'server/assistant/semantic-interpreter.test.ts',
  'server/assistant/coverage-function-recovery.test.ts',
  'server/assistant/hr-management-conversation.test.ts',
  'server/assistant/fallback-guidance.test.ts',
  'server/service/openrouter.chat.test.ts',
  'server/service/openrouter-transport.test.ts',
] } });
