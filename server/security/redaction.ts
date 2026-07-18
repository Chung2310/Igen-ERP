const SENSITIVE_KEY = /(password|token|secret|authorization|cookie|private[_-]?key|recovery[_-]?code)/i;

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === "object") {
    if (value instanceof Date) return new Date(value);
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactSensitive(nested)]));
  }
  return value;
}
