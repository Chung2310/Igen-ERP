import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("../../../service/company-email.service", () => ({
  companyEmailService: { getSmtp: async () => ({ hasPassword: true }), send: (...args: any[]) => send(...args) },
}));

const { MARKETING_CHANNEL_ADAPTERS } = await import("./marketing-channels");

describe("đính kèm tệp theo kênh gửi", () => {
  beforeEach(() => { send.mockReset(); send.mockResolvedValue({ messageId: "id-1" }); });

  it("email chuyển tệp đính kèm xuống SMTP", async () => {
    const attachments = [{ filename: "HD-001.pdf", content: Buffer.from("pdf"), contentType: "application/pdf" }];
    await MARKETING_CHANNEL_ADAPTERS.email.send("IGEN", { to: "a@b.com", subject: "s", html: "<p>h</p>", attachments });
    expect(send).toHaveBeenCalledWith("IGEN", expect.objectContaining({ attachments }));
  });

  it("không gửi trường attachments khi không có tệp nào", async () => {
    await MARKETING_CHANNEL_ADAPTERS.email.send("IGEN", { to: "a@b.com", subject: "s", html: "<p>h</p>" });
    expect(send.mock.calls[0][1]).not.toHaveProperty("attachments");
  });

  it("chỉ email khai báo hỗ trợ đính kèm", () => {
    expect(MARKETING_CHANNEL_ADAPTERS.email.supportsAttachments).toBe(true);
    for (const channel of ["sms", "zalo", "tiktok"] as const) {
      expect(MARKETING_CHANNEL_ADAPTERS[channel].supportsAttachments).toBe(false);
    }
  });
});
