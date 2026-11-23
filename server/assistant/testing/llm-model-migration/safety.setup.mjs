import '../layer-b-product-audit/safety.setup.mjs';
import { afterEach, expect, vi } from 'vitest';

// Controller imports construct rate-limit stores; they must not start a real Redis connection.
vi.mock('../../../infrastructure/rate-limit-redis', async importOriginal => ({
  ...await importOriginal(),
  getRateLimitRedisClient: () => ({ eval: async () => [1, 60000], decr: async () => 0, del: async () => 0 }),
}));
afterEach(() => expect(globalThis.__layerBProductSafety.violations).toEqual([]));
