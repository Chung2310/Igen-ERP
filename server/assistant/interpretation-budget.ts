import { openrouterChat } from "../service/openrouter.service";
import { AssistantError } from "./policy";
import { AssistantInterpretationError } from './interpretation-error';
import { PlanStoppedError } from './execution-budget';
import type { SemanticRequest } from './semantic-request';

export const INTERPRETATION_LIMITS = {
  calls: 6,
  promptBytes: 96_000,
  totalPromptBytes: 256_000,
  workflows: 24,
  candidateWorkflows: 120,
  modules: 8,
  capabilityBytes: 56_000,
} as const;
export interface InterpretationBudget { calls: number; promptBytes: number; reviewJsonRepairAttempted?:boolean; functionRecoveryAttempted?: boolean; clarificationModules?: string[]; semanticRequests?:Map<string,SemanticRequest>; semanticRepairAttempted?:boolean; semanticPredicateReviewAttempted?:boolean; semanticSourceRepairAttempted?:boolean; capabilityCandidates?:string[]; capabilityRecoveryAttempted?:boolean; semanticClarification?:string; }
export const newInterpretationBudget = (): InterpretationBudget => ({ calls: 0, promptBytes: 0 });
export class InterpretationBudgetExceeded extends AssistantError {
  constructor() { super("Mình chưa hoàn tất việc chọn và kiểm tra thao tác trong giới hạn xử lý của lượt này. Bạn thử lại giúp mình nhé.", 413); }
}
export function interpretationPromptBytes(input: Parameters<typeof openrouterChat>[0]) {
  // The provider injects the schema as a string inside a JSON message. Count
  // escaped quotes/newlines too; reserve 2 KB for the instruction/body framing.
  const schema = input.responseSchema ? JSON.stringify(JSON.stringify(input.responseSchema, null, 2)) : "";
  return Buffer.byteLength(JSON.stringify(input.messages), "utf8")
    + Buffer.byteLength(schema, "utf8") + 2048;
}
export async function requestAssistantInterpretation(budget: InterpretationBudget, input: Parameters<typeof openrouterChat>[0]) {
  const bytes = interpretationPromptBytes(input);
  if (budget.calls >= INTERPRETATION_LIMITS.calls || bytes > INTERPRETATION_LIMITS.promptBytes
    || budget.promptBytes + bytes > INTERPRETATION_LIMITS.totalPromptBytes) throw new InterpretationBudgetExceeded();
  budget.calls++;
  budget.promptBytes += bytes;
  // openrouterChat counts maxRetries as total attempts, starting at one.
  try {
    return await openrouterChat({ ...input, maxRetries: 1, maxTokens: Math.min(input.maxTokens || 4096, 4096) });
  } catch (error) {
    // Preserve cancellation/deadline and execution-control errors rather than
    // translating them into connectivity errors or retrying a broader catalog.
    if (error instanceof PlanStoppedError || error instanceof AssistantError) throw error;
    const status = (error as { status?: unknown } | null)?.status;
    const providerStatus = typeof status === 'number' ? status : undefined;
    const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    console.warn('[assistant interpretation] Provider request failed', { status: providerStatus, timedOut });
    throw new AssistantInterpretationError(providerStatus, timedOut);
  }
}
