import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ openrouterChat: vi.fn() }));
vi.mock("../service/openrouter.service", () => ({ openrouterChat: state.openrouterChat }));

import { operationById } from "./catalog";
import { extractAssistantAttachmentValues } from "./attachment-values";

describe("assistant image field extraction", () => {
  beforeEach(() => state.openrouterChat.mockReset());

  it("extracts only allowed employee values from a request image", async () => {
    state.openrouterChat.mockResolvedValueOnce({ text: JSON.stringify({
      displayName: "Nguyễn An",
      birthDate: "1992-03-04",
      email: "an@example.com",
      password: "secret-from-image",
      unrelated: "discard-me",
    }) });
    const operation = operationById("employee.create")!;

    const values = await extractAssistantAttachmentValues({
      requestText: "Tạo nhân sự mới theo thông tin trên CCCD",
      operation,
      attachments: [{ fileName: "cccd.png", dataUrl: "data:image/jpeg;base64,ZmFrZQ==" }],
    });

    expect(values).toEqual({ displayName: "Nguyễn An", birthDate: "1992-03-04", email: "an@example.com" });
    const request = state.openrouterChat.mock.calls[0]?.[0];
    expect(request.messages[0].content).toContain("không đáng tin cậy");
    expect(request.messages[1].content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "image_url", image_url: { url: "data:image/jpeg;base64,ZmFrZQ==" } }),
    ]));
  });

  it("drops invalid dates and fields outside the operation contract", async () => {
    state.openrouterChat.mockResolvedValueOnce({ text: JSON.stringify({
      birthDate: "04/03/1992",
      email: "",
      branchId: "forbidden-system-scope",
    }) });

    const values = await extractAssistantAttachmentValues({
      requestText: "Tạo nhân sự mới",
      operation: operationById("employee.create")!,
      attachments: [{ fileName: "ho-so.webp", dataUrl: "data:image/jpeg;base64,ZmFrZQ==" }],
    });

    expect(values).toEqual({});
  });
});
