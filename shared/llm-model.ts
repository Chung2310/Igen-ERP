/** One application policy for language/vision-to-text tasks; media generation uses its own models. */
export const ERP_LLM_MODEL = "openai/gpt-6-luna";

/** GPT-6 endpoints do not accept temperature. Keep it off the wire, including defaults. */
export function llmSamplingParameters(model: string, temperature?: number): { temperature?: number } {
  return /^openai\/gpt-6(?:[.-]|$)/.test(model) || temperature === undefined ? {} : { temperature };
}
