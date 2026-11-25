import {defineConfig} from 'vitest/config';
import base from '../catalog-routing/vitest.config.mjs';
export default defineConfig({...base,test:{...base.test,include:[
 'server/assistant/hr-local-regression.test.ts',
 'server/assistant/request-coverage.test.ts',
 'server/assistant/semantic-interpreter.test.ts',
 'server/assistant/attachment-values.test.ts',
 'server/assistant/capability-context.test.ts',
 'server/utils/assistant-crud-date-filters.test.ts',
]}});
