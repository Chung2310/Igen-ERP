import { describe, expect, it } from "vitest";
import { buildCodexCliArgs, summarizeCodexCliFailure } from "./codex-cli-planner";

describe("Codex CLI planner invocation", () => {
  it("keeps the dynamic planner schema in the prompt instead of passing it as a strict output schema", () => {
    const plannerArgs = buildCodexCliArgs("planner", undefined, "gpt-6.2-sol");
    expect(plannerArgs).not.toContain("--output-schema");
    expect(plannerArgs).toContain("gpt-6.2-sol");

    const analysisArgs = buildCodexCliArgs("analysis", "response-schema.json");
    expect(analysisArgs).toEqual(expect.arrayContaining(["--output-schema", "response-schema.json"]));
  });

  it("summarizes structured stderr metadata without retaining prompt text", () => {
    const summary = summarizeCodexCliFailure('ERROR: {"type":"error","error":{"message":"private user prompt","type":"invalid_request_error","param":"text.format.schema","code":"invalid_json_schema"},"status":400}');

    expect(summary).toBe("provider_error invalid_request_error invalid_json_schema text.format.schema");
    expect(summary).not.toContain("private user prompt");
  });

  it("classifies sandbox policy denials without returning raw CLI output", () => {
    expect(summarizeCodexCliFailure('CreateProcess rejected: blocked by policy for "private command"'))
      .toBe("sandbox_command_blocked");
  });
});
