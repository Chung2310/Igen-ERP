import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generateReplyCompletion } from "../../message/service/ai-reply-provider";
import { readTelecomInvoice } from "../../message/service/telecom-invoice-ocr";
import { generateText } from "./gemini/core";
import { geminiChatService } from "./gemini/chat.service";
import { geminiController } from "../controller/gemini.controller";

vi.mock("./ai-subscription.service", () => ({
  billAiCall: (_kind: string, _model: string, action: () => Promise<unknown>) => action(),
}));

vi.mock("./wallet.service", () => ({
  API_COSTS: { GEMINI_FAQ: 1 },
  walletService: { checkBalance: vi.fn(), deductBalance: vi.fn() },
}));

const fetchMock = vi.fn<typeof fetch>();
const reply = (text: string) => Response.json({ choices: [{ message: { content: text } }] });

function usedKeys() {
  return fetchMock.mock.calls.map(([, options]) => new Headers(options?.headers).get("Authorization"));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("OPENROUTER_API_KEY", "erp-test-key");
  vi.stubEnv("OPENROUTER_CHAT_MESSAGE_API_KEY", "chat-message-test-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("isolates Chat Message and shared marketing completions while both keys are configured", async () => {
  fetchMock.mockImplementation(async (_url, options) => {
    const key = new Headers(options?.headers).get("Authorization");
    return reply(key === "Bearer chat-message-test-key" ? "message" : "shared");
  });

  const [message, shared] = await Promise.all([
    generateText("test/model", "Chat reply", { keyScope: "chat-message" }),
    generateText("test/model", "Campaign caption"),
  ]);
  expect(message.text).toBe("message");
  expect(shared.text).toBe("shared");
  expect(usedKeys()).toEqual(expect.arrayContaining(["Bearer chat-message-test-key", "Bearer erp-test-key"]));
});

it("uses the dedicated key for both the OCR primary model and its fallback", async () => {
  fetchMock.mockResolvedValueOnce(new Response("Model unavailable", { status: 404 }));
  fetchMock.mockResolvedValueOnce(reply(JSON.stringify({
    kind: "invoice", fields: { subscriber_code: { status: "readable", text: "TEST-001" } },
  })));

  const reading = await readTelecomInvoice("data:image/png;base64,AA==", [
    { key: "subscriber_code", label: "Mã thuê bao", question: "Mã thuê bao là gì?", required: true },
  ], "subscriber_code", Date.now() + 10_000);

  expect(reading.values).toEqual({ subscriber_code: "TEST-001" });
  expect(usedKeys()).toEqual(["Bearer chat-message-test-key", "Bearer chat-message-test-key"]);
});

it("sends no provider request when Chat Message has only the ERP key available", async () => {
  vi.stubEnv("OPENROUTER_CHAT_MESSAGE_API_KEY", " ");

  await expect(generateReplyCompletion({ messages: [{ role: "user", content: "Reply" }] }))
    .rejects.toThrow("OPENROUTER_CHAT_MESSAGE_API_KEY");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("reports missing Chat Message configuration instead of faking a normal CRM reply", async () => {
  vi.stubEnv("OPENROUTER_CHAT_MESSAGE_API_KEY", "");

  await expect(geminiChatService.chat("Cho em hỏi giờ mở cửa", [], { companyName: "Demo" }))
    .rejects.toMatchObject({ code: "CHAT_MESSAGE_OPENROUTER_KEY_MISSING" });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("uses the Chat Message key for knowledge uploads that require AI extraction", async () => {
  fetchMock.mockResolvedValueOnce(reply("Kịch bản tư vấn mẫu."));
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));

  await geminiController.uploadLocalDocument({
    user: { id: "local-user" },
    body: { fileName: "scenario.png", fileBase64: "AA==", mimeType: "image/png", extractOnly: true },
  } as never, { status } as never);

  expect(status).toHaveBeenCalledWith(200);
  expect(json).toHaveBeenCalledWith(expect.objectContaining({ text: "Kịch bản tư vấn mẫu." }));
  expect(usedKeys()).toEqual(["Bearer chat-message-test-key"]);
});
