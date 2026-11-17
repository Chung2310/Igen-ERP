export type CatalogRequestAttempt = { key: string; fingerprint: string };

export function catalogIdempotencyKeyFor(attempt: CatalogRequestAttempt, payload: unknown, createKey: () => string = () => crypto.randomUUID()) {
  const fingerprint = JSON.stringify(payload);
  if (!attempt.key || attempt.fingerprint !== fingerprint) {
    attempt.key = createKey();
    attempt.fingerprint = fingerprint;
  }
  return attempt.key;
}
