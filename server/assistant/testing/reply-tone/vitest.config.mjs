import { defineConfig } from 'vitest/config';
import base from '../catalog-routing/vitest.config.mjs';

export default defineConfig({ ...base, test: { ...base.test, include: [
  'server/assistant/reply-presentation.test.ts',
  'server/assistant/natural-conversation.test.ts',
  'server/assistant/fallback-guidance.test.ts',
  'server/assistant/reply-tone.test.ts',
  'server/assistant/reply-rules.test.ts',
  'server/assistant/reply-tone-render.test.tsx',
  'src/components/common/AssistantMessageContent.test.tsx',
  'server/assistant/request-guidance.test.ts',
  'server/assistant/result-format.test.ts',
  'server/assistant/worker-management-conversation.test.ts',
  'server/assistant/student-profile-conversation.test.ts',
  'server/assistant/hr-management-conversation.test.ts',
  'server/assistant/healthcare-conversation.test.ts',
  'server/assistant/quotation-conversation.test.ts',
] } });
