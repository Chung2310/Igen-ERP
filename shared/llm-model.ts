/** One application policy for language/vision-to-text tasks; media generation uses its own models. */
export const ERP_LLM_MODEL = "openai/gpt-6-luna";
export const ERP_LLM_FALLBACK_MODEL = "anthropic/claude-haiku-5.5";

/** Fail over for availability failures, never for credentials, billing or bad input. */
export function shouldFallbackLlm(error: unknown): boolean {
  const failure = error as { status?: number; name?: string; message?: string; code?: string; cause?: { code?: string } } | null;
  if (failure?.status) return [404, 408, 429, 500, 502, 503, 504].includes(failure.status);
  return failure?.name === 'TimeoutError' || failure?.name === 'AbortError'
    || ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND'].includes(failure?.code || failure?.cause?.code || '')
    || /fetch failed|network error/i.test(failure?.message || '');
}

/** These endpoints do not support temperature; omit caller defaults from the wire. */
export function llmSamplingParameters(model: string, temperature?: number): { temperature?: number } {
  return /^openai\/gpt-6(?:[.-]|$)/.test(model)
    || /^anthropic\/claude-haiku-5\.5(?:$|:)/.test(model)
    || temperature === undefined ? {} : { temperature };
}
