import '../layer-b-product-audit/safety.setup.mjs';
import { afterAll, expect, vi } from 'vitest';

vi.mock('../../../infrastructure/rate-limit-redis', async importOriginal => ({
  ...await importOriginal(),
  getRateLimitRedisClient: () => ({ eval: async () => [1, 60000], decr: async () => 0, del: async () => 0 }),
}));
afterAll(() => {
  // Even an attempted request swallowed by runtime error handling fails the suite.
  expect(globalThis.__layerBProductSafety.violations).toEqual([]);
});
