import { ERP_LLM_MODEL } from "../../../shared/llm-model";
/** Fixed OpenRouter model IDs used by the architecture module. */
export const ARCHITECT_ASSISTANT_MODELS = Object.freeze({
  floorPlan: ERP_LLM_MODEL,
  vision: ERP_LLM_MODEL,
  render: "google/gemini-3.1-flash-image",
  video: "google/veo-3.1",
});
