import { expect, it } from "vitest";
import { ARCHITECT_ASSISTANT_MODELS } from "./models";
import { ERP_LLM_MODEL } from '../../../shared/llm-model';

it("uses the fixed OpenRouter model IDs for architecture plan, image, and video calls", () => {
  expect(ARCHITECT_ASSISTANT_MODELS).toEqual({
    floorPlan: ERP_LLM_MODEL,
    vision: ERP_LLM_MODEL,
    render: "google/gemini-3.1-flash-image",
    video: "google/veo-3.1",
  });
  expect(Object.isFrozen(ARCHITECT_ASSISTANT_MODELS)).toBe(true);
});
