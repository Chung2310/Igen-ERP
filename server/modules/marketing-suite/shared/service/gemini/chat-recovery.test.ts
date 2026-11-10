import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GeminiChatService } from "./chat.service";
import { generateText } from "./core";
import { openrouterChat } from "../openrouter.service";

vi.mock("../ai-subscription.service", () => ({
  billAiCall: (_kind: string, _model: string, action: () => Promise<unknown>) => action(),
}));

beforeEach(() => { vi.stubEnv("OPENROUTER_API_KEY", "test-key"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

type RequestBody = { model: string; messages: Array<{ role: string; content: string }>;
  max_tokens?: number; reasoning?: { effort: string } };

function provider(outputs: string[]) {
  const requests: RequestBody[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    const body = JSON.parse(String(init.body));
    const text = outputs[requests.length];
    expect(text, "Unexpected provider request").not.toBeUndefined();
    requests.push(body);
    return Response.json({ choices: [{ message: { content: text } }] });
  }));
  return requests;
}

it("recovers a truncated contact-rule review and independently verifies the corrected answer", async () => {
  const expected = "Trần Nano từ 320.000đ/m² ạ. Chị Thủy cho em xin số điện thoại liên hệ nhé?";
  const requests = provider(["Trần Nano từ 320.000đ/m² ạ", '{"correctedParts":["',
    JSON.stringify({ compliant: true, correctedParts: [expected] }), '{"compliant":true}']);
  const result = await new GeminiChatService().chat("Trần Nano giá bao nhiêu?", [
    { sender: "user", text: "Tôi tên Thủy. Có bán hàng k" },
    { sender: "model", text: "Ruby Queen có thi công trần Nano ạ" },
    { sender: "user", text: "Ốp tường Nano giá bao nhiêu?" },
    { sender: "model", text: "Từ 220.000đ/m² ạ" },
  ], { companyName: "Ruby Queen", advancedInstructions: "Câu 3 trả lời trước rồi xin số điện thoại. Không hỏi lại tên đã có." },
  { contextText: "Trần Nano từ 320.000đ/m². Hotline 0965959929." });
  expect(result.text).toBe(expected);
  expect(requests.map(item => item.model)).toEqual([
    "openai/gpt-6-luna", "openai/gpt-6-luna", "deepseek/deepseek-v4.1-flash", "openai/gpt-6-luna",
  ]);
  for (const request of requests.slice(1)) {
    expect(request.max_tokens).toBe(4096);
    expect(request.reasoning).toEqual({ effort: "low" });
  }
  expect(requests[1].messages).toEqual(requests[2].messages);
  expect(JSON.stringify(requests[3].messages)).toContain("Thủy");
});

it("never returns an unchecked draft when both rule-review models fail", async () => {
  const requests = provider(["Unchecked draft", '{"correctedParts":["', '{"compliant":']);
  await expect(new GeminiChatService().chat("Có bán hàng k", [], {
    companyName: "Ruby Queen", advancedInstructions: "Theo tài liệu và rule 3/5.",
  })).rejects.toMatchObject({ providerCode: "INVALID_JSON_COMPLETION", operation: "reply_rule_review" });
  expect(requests).toHaveLength(3);
});

it("keeps the final failed verification closed after its single repair attempt", async () => {
  const corrected = JSON.stringify({ compliant: true, correctedParts: ["Grounded answer"] });
  const requests = provider(["Draft", corrected, '{"compliant":false}', corrected, '{"compliant":false}']);
  await expect(new GeminiChatService().chat("Có bán hàng k", [], {
    companyName: "Ruby Queen", advancedInstructions: "Only grounded facts.",
  })).rejects.toThrow("could not confirm a compliant reply");
  expect(requests).toHaveLength(5);
});

it("reports fallback JSON failure with token diagnostics and retains the primary empty-completion reason", async () => {
  let calls = 0;
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({
    choices: [{ finish_reason: "length", message: { content: ++calls === 1 ? "" : '{"compliant":true,"correctedParts":["' } }],
    usage: { completion_tokens: 4096, completion_tokens_details: { reasoning_tokens: 4000 } },
  })));
  await expect(generateText("openai/gpt-6-luna", "Review", {
    responseSchema: { compliant: "boolean" }, maxTokens: 4096, maxRetries: 1,
    reasoning: { effort: "low" }, operation: "reply_rule_review",
  })).rejects.toMatchObject({ providerCode: "INVALID_JSON_COMPLETION", operation: "reply_rule_review",
    finishReason: "length", completionTokens: 4096, reasoningTokens: 4000,
    primaryFailure: { providerCode: "EMPTY_COMPLETION", finishReason: "length" } });
  expect(calls).toBe(2);
});

it("keeps diagnostic metadata internal while reporting nonempty truncated responses", async () => {
  let body: Record<string, unknown>;
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    body = JSON.parse(String(init.body));
    return Response.json({ model: "openai/gpt-6-luna", choices: [{ finish_reason: "length", message: { content: '{"unfinished":' } }],
      usage: { completion_tokens: 4096, completion_tokens_details: { reasoning_tokens: 4000 } } });
  }));
  let diagnostics: unknown;
  const result = await openrouterChat({ model: "openai/gpt-6-luna", messages: [{ role: "user", content: "Check" }],
    operation: "reply_rule_review", onDiagnostics: value => { diagnostics = value; } });
  expect(Object.keys(result)).toEqual(["text"]);
  expect(diagnostics).toEqual({ model: "openai/gpt-6-luna", finishReason: "length", completionTokens: 4096, reasoningTokens: 4000 });
  expect(body.operation).toBeUndefined();
  expect(body.onDiagnostics).toBeUndefined();
});
