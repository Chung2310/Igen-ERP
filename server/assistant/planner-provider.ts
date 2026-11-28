import type { OpenRouterChatParams } from "../service/openrouter.service";
import { openrouterChat } from "../service/openrouter.service";
import { AssistantError } from "./policy";
import { codexCliAnalysisChat, codexCliPlannerChat } from "./codex-cli-planner";

export type AssistantPlannerResponse = { text: string; citations?: Array<{ title: string; url: string }> };
export type AssistantPlannerCall = (params: OpenRouterChatParams, signal?: AbortSignal) => Promise<AssistantPlannerResponse>;

export interface AssistantPlannerDependencies {
  openrouter?: AssistantPlannerCall;
  codexCli?: AssistantPlannerCall;
  codexCliAnalysis?: AssistantPlannerCall;
}

/** Selects the semantic planner provider without changing ERP action execution. */
export async function assistantPlannerChat(
  params: OpenRouterChatParams,
  dependencies: AssistantPlannerDependencies = {},
  signal?: AbortSignal,
): Promise<AssistantPlannerResponse> {
  const provider = process.env.ASSISTANT_PLANNER_PROVIDER?.trim().toLowerCase() || "openrouter";
  if (provider === "codex-cli") return (dependencies.codexCli || codexCliPlannerChat)(params, signal);
  if (provider === "openrouter") return (dependencies.openrouter || openrouterChat)(params);
  throw new AssistantError("ASSISTANT_PLANNER_PROVIDER chỉ nhận openrouter hoặc codex-cli.", 500);
}

/** Uses the configured agent/provider after the server has fetched and projected authorized read-only data. */
export async function assistantAnalysisChat(
  params: OpenRouterChatParams,
  dependencies: AssistantPlannerDependencies = {},
  signal?: AbortSignal,
): Promise<AssistantPlannerResponse> {
  const provider = process.env.ASSISTANT_PLANNER_PROVIDER?.trim().toLowerCase() || "openrouter";
  if (provider === "codex-cli") return (dependencies.codexCliAnalysis || codexCliAnalysisChat)(params, signal);
  if (provider === "openrouter") return (dependencies.openrouter || openrouterChat)(params);
  throw new AssistantError("ASSISTANT_PLANNER_PROVIDER chỉ nhận openrouter hoặc codex-cli.", 500);
}
