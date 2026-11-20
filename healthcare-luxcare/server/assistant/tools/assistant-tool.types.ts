import type { AssistantAccessContext, AssistantEvidence } from "../assistant.types";

export interface AssistantToolDefinition<TArgs = Record<string, unknown>> {
  name: string;
  permission: string;
  parseArgs(value: unknown): TArgs;
  execute(args: TArgs, context: AssistantAccessContext): Promise<AssistantEvidence[]>;
}
