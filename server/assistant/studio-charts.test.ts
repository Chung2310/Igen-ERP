import { describe, expect, it } from "vitest";
import { defaultAssistantChartPrompt } from "../../src/shared/assistant-chart";
import { resolveStudioChartPrompt, studioChartRequestSchema } from "./studio-charts";

describe("studio chart prompts", () => {
  it("allows the prompt to be omitted or left blank", () => {
    expect(studioChartRequestSchema.validate({}).error).toBeUndefined();
    expect(studioChartRequestSchema.validate({ prompt: "   " }).error).toBeUndefined();
  });

  it("uses the built-in data analysis prompt when the user leaves it blank", () => {
    expect(resolveStudioChartPrompt(undefined)).toBe(defaultAssistantChartPrompt);
    expect(resolveStudioChartPrompt("   ")).toBe(defaultAssistantChartPrompt);
    expect(resolveStudioChartPrompt("Vẽ doanh thu theo tháng")).toBe("Vẽ doanh thu theo tháng");
  });
});
