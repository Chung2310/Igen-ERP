export const LEAD_INTAKE_BUSINESS_CONTEXT_LIMIT = 12_000;

export function buildChatBusinessContext(
  config: { advancedInstructions?: unknown; customerServiceScript?: unknown },
  knowledge: { contextText?: string; scenarioContextText?: string },
) {
  return [config.advancedInstructions, config.customerServiceScript, knowledge.contextText, knowledge.scenarioContextText]
    .filter((text): text is string => typeof text === "string" && Boolean(text.trim()))
    .join("\n\n");
}
