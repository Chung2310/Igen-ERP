import { afterEach, describe, expect, it, vi } from "vitest";
import { assistantAnalysisChat, assistantPlannerChat } from "./planner-provider";
import type { OpenRouterChatParams } from "../service/openrouter.service";

const params: OpenRouterChatParams = {
  model: "unused-in-codex-mode",
  jsonMode: true,
  responseSchema: { type: "object", required: ["actionId"], properties: { actionId: { type: ["string", "null"] } } },
  messages: [
    { role: "system", content: "Chọn action trong danh mục đang được cấp." },
    { role: "user", content: "Tra cứu nhân viên Lan." },
  ],
};

afterEach(() => vi.unstubAllEnvs());

describe("assistant planner provider", () => {
  it("routes semantic planning through Codex CLI when selected", async () => {
    vi.stubEnv("ASSISTANT_PLANNER_PROVIDER", "codex-cli");
    const codexCli = vi.fn(async () => ({ text: '{"actionId":"employee.list"}' }));
    const openrouter = vi.fn(async () => ({ text: "{}" }));

    const result = await assistantPlannerChat(params, { codexCli, openrouter });

    expect(result.text).toBe('{"actionId":"employee.list"}');
    expect(codexCli).toHaveBeenCalledWith(params, undefined);
    expect(openrouter).not.toHaveBeenCalled();
  });

  it("forwards semantic timeout cancellation to the Codex runner", async () => {
    vi.stubEnv("ASSISTANT_PLANNER_PROVIDER", "codex-cli");
    const controller = new AbortController();
    const codexCli = vi.fn(async () => ({ text: "{}" }));

    await assistantPlannerChat(params, { codexCli }, controller.signal);

    expect(codexCli).toHaveBeenCalledWith(params, controller.signal);
  });

  it("keeps OpenRouter as the default until Codex is explicitly enabled", async () => {
    vi.stubEnv("ASSISTANT_PLANNER_PROVIDER", "");
    const codexCli = vi.fn(async () => ({ text: "{}" }));
    const openrouter = vi.fn(async () => ({ text: '{"actionId":"employee.list"}' }));

    const result = await assistantPlannerChat(params, { codexCli, openrouter });

    expect(result.text).toBe('{"actionId":"employee.list"}');
    expect(openrouter).toHaveBeenCalledWith(params);
    expect(codexCli).not.toHaveBeenCalled();
  });

  it("rejects unsupported provider names rather than silently changing providers", async () => {
    vi.stubEnv("ASSISTANT_PLANNER_PROVIDER", "unknown");

    await expect(assistantPlannerChat(params, { openrouter: vi.fn(), codexCli: vi.fn() }))
      .rejects.toThrow("ASSISTANT_PLANNER_PROVIDER chỉ nhận openrouter hoặc codex-cli.");
  });

  it("does not fall back to OpenRouter after a Codex CLI failure", async () => {
    vi.stubEnv("ASSISTANT_PLANNER_PROVIDER", "codex-cli");
    const failure = new Error("Codex CLI failed");
    const codexCli = vi.fn(async () => { throw failure; });
    const openrouter = vi.fn(async () => ({ text: "{}" }));

    await expect(assistantPlannerChat(params, { codexCli, openrouter })).rejects.toBe(failure);
    expect(openrouter).not.toHaveBeenCalled();
  });

  it("routes structured report analysis through the Codex agent when selected", async () => {
    vi.stubEnv("ASSISTANT_PLANNER_PROVIDER", "codex-cli");
    const codexCliAnalysis = vi.fn(async () => ({ text: '{"summary":"ok"}' }));
    const openrouter = vi.fn(async () => ({ text: "{}" }));

    const result = await assistantAnalysisChat(params, { codexCliAnalysis, openrouter });

    expect(result.text).toBe('{"summary":"ok"}');
    expect(codexCliAnalysis).toHaveBeenCalledWith(params, undefined);
    expect(openrouter).not.toHaveBeenCalled();
  });

  it("keeps report analysis on OpenRouter by default", async () => {
    vi.stubEnv("ASSISTANT_PLANNER_PROVIDER", "");
    const codexCliAnalysis = vi.fn(async () => ({ text: "{}" }));
    const openrouter = vi.fn(async () => ({ text: '{"summary":"ok"}' }));

    const result = await assistantAnalysisChat(params, { codexCliAnalysis, openrouter });

    expect(result.text).toBe('{"summary":"ok"}');
    expect(openrouter).toHaveBeenCalledWith(params);
    expect(codexCliAnalysis).not.toHaveBeenCalled();
  });
});
