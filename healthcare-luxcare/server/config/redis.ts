type EnvLike = Record<string, string | undefined>;

export function isRedisEnabled(env: EnvLike = process.env): boolean {
  const configuredValue = env.REDIS_ENABLED;
  if (configuredValue === undefined) return true;

  const normalizedValue = configuredValue.trim().toLowerCase();
  if (!normalizedValue) return true;
  return !["0", "false", "no", "off"].includes(normalizedValue);
}
