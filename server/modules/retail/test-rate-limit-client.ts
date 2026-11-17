import { setRateLimitRedisClientForTesting } from "../../infrastructure/rate-limit-redis";

setRateLimitRedisClientForTesting({
  eval: async () => [1, 60_000],
  decr: async () => 0,
  del: async () => 0,
});
