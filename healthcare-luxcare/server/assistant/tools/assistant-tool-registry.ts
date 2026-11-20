import { assertToolAccess } from "../assistant-access";
import type { AssistantAccessContext, AssistantEvidence } from "../assistant.types";
import type { AssistantToolDefinition } from "./assistant-tool.types";

export function createAssistantToolRegistry(definitions: AssistantToolDefinition[]) {
  const tools = new Map(definitions.map((definition) => [definition.name, definition]));
  return {
    list(context: AssistantAccessContext) {
      return definitions.filter((tool) => context.permissions.has("*") || context.permissions.has(tool.permission));
    },
    async execute(name: string, rawArgs: unknown, context: AssistantAccessContext): Promise<AssistantEvidence[]> {
      const tool = tools.get(name);
      if (!tool) throw new Error("Công cụ không được phép.");
      assertToolAccess(context, tool);
      const args = tool.parseArgs(rawArgs);
      return (await tool.execute(args, context)).slice(0, 50);
    },
  };
}
