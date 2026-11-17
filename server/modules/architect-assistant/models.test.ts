import { expect, it } from "vitest";
import { ARCHITECT_ASSISTANT_MODELS } from "./models";

it("uses the fixed OpenRouter model IDs for architecture plan, image, and video calls", () => {
  expect(ARCHITECT_ASSISTANT_MODELS).toEqual({
    floorPlan: "openai/gpt-6-luna",
    vision: "google/gemini-2.5-flash",
    render: "google/gemini-3.1-flash-image",
    video: "google/veo-3.1",
  });
  expect(Object.isFrozen(ARCHITECT_ASSISTANT_MODELS)).toBe(true);
});
