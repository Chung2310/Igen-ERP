import { defineConfig } from 'vitest/config';
import base from '../catalog-routing/vitest.config.mjs';
export default defineConfig({ ...base, test: { ...base.test, include: [
  'server/assistant/singapore-regression.test.ts',
  'server/assistant/request-coverage.test.ts',
  'server/assistant/semantic-interpreter.test.ts',
  'server/assistant/composite-query.test.ts',
  'server/assistant/result-format.test.ts',
  'server/assistant/reference-projection.test.ts',
  'server/assistant/collection-form.test.ts',
  'server/assistant/student-profile-conversation.test.ts',
  'server/assistant/hr-local-regression.test.ts',
  'server/assistant/audited-query-contracts.test.ts',
] } });
