import { afterEach, expect, it, vi } from "vitest";
import { assistantService } from "./assistantService";
import type { AssistantGeneratedFile } from "../shared/assistant-document";

afterEach(() => vi.unstubAllGlobals());

it("downloads generated documents with authentication and branch scope and rejects login HTML", async () => {
  const file: AssistantGeneratedFile = { id: "file-id", conversationId: "conversation-id", documentId: "doc-id", version: 1, fileName: "ke-hoach.pdf", format: "pdf", mimeType: "application/pdf", size: 5 };
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("%PDF-", { headers: { "content-type": "application/pdf" } })).mockResolvedValueOnce(new Response("<html>Login</html>", { headers: { "content-type": "text/html" } }));
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("localStorage", { getItem: () => "token" });
  expect((await assistantService.downloadFile(file, "branch-a")).size).toBe(5);
  expect(fetcher.mock.calls[0][0]).toBe("/api/v1/chatbot/assistant/conversations/conversation-id/files/file-id");
  expect(fetcher.mock.calls[0][1].headers).toMatchObject({ Authorization: "Bearer token", "x-branch-id": "branch-a" });
  await expect(assistantService.downloadFile(file)).rejects.toThrow("định dạng tệp");
});

it("sends the selected branch to assistant turns as authenticated context", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { status: "completed", reply: "Đã xong" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("localStorage", { getItem: vi.fn(() => "test-token") });

  await assistantService.turn({ conversationId: "conversation", requestId: "request", text: "Xem giao dịch" }, undefined, "507f1f77bcf86cd799439012");

  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][1].headers).toMatchObject({
    Authorization: "Bearer test-token",
    "x-branch-id": "507f1f77bcf86cd799439012",
  });
});

it("sends the current POS device as authenticated assistant context", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { status: "completed", reply: "Đã xong" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("localStorage", { getItem: vi.fn(() => "test-token") });

  await assistantService.turn({ conversationId: "conversation", requestId: "request", text: "Tiếp tục ca POS" }, undefined, "branch-current", "terminal-current");

  expect(fetcher.mock.calls[0][1].headers).toMatchObject({
    "x-branch-id": "branch-current",
    "x-device-id": "terminal-current",
  });
});

it("reads authenticated MP3 speech responses instead of parsing them as JSON", async () => {
  const audio = new Uint8Array([0x49, 0x44, 0x33]);
  const fetcher = vi.fn().mockResolvedValue(new Response(audio, { status: 200, headers: { "content-type": "audio/mpeg" } }));
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("localStorage", { getItem: vi.fn(() => "test-token") });

  const result = await assistantService.speech("Xin chào", undefined, "george");

  expect(new Uint8Array(await result.arrayBuffer())).toEqual(audio);
  expect(fetcher.mock.calls[0][0]).toBe("/api/v1/chatbot/assistant/speech");
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    method: "POST",
    headers: { Authorization: "Bearer test-token" },
    body: JSON.stringify({ text: "Xin chào", voice: "george" }),
  });
});
