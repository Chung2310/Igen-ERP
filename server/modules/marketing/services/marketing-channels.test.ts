import { beforeEach, describe, expect, it, vi } from "vitest";

const getSmtp = vi.fn();
vi.mock("../../../service/company-email.service", () => ({ companyEmailService: { getSmtp: (...args: any[]) => getSmtp(...args) } }));

const { MARKETING_CHANNEL_ADAPTERS, resolveSendableChannel } = await import("./marketing-channels");

describe("resolveSendableChannel", () => {
  beforeEach(() => { getSmtp.mockReset(); });

  it("chọn email khi công ty đã cấu hình SMTP", async () => {
    getSmtp.mockResolvedValue({ hasPassword: true });
    const adapter = await resolveSendableChannel("IGEN", ["email"]);
    expect(adapter?.channel).toBe("email");
  });

  it("bỏ qua email khi SMTP thiếu mật khẩu", async () => {
    getSmtp.mockResolvedValue({ hasPassword: false });
    expect(await resolveSendableChannel("IGEN", ["email"])).toBeUndefined();
  });

  it("bỏ qua kênh chưa nối API và lùi về email", async () => {
    getSmtp.mockResolvedValue({ hasPassword: true });
    const adapter = await resolveSendableChannel("IGEN", ["zalo", "sms", "email"]);
    expect(adapter?.channel).toBe("email");
  });

  it("các kênh chưa nối API đều báo lỗi rõ ràng khi bị gọi", async () => {
    for (const channel of ["sms", "zalo", "tiktok"] as const) {
      const adapter = MARKETING_CHANNEL_ADAPTERS[channel];
      expect(adapter.implemented).toBe(false);
      await expect(adapter.send("IGEN", { to: "x", subject: "s", html: "h" })).rejects.toThrow(/NOT_IMPLEMENTED/);
    }
  });

  it("email lấy địa chỉ từ hồ sơ khách hàng, kênh SMS lấy số điện thoại", () => {
    const customer = { email: "A@Example.com ", phone: "0900000000" };
    expect(MARKETING_CHANNEL_ADAPTERS.email.recipientOf(customer)).toBe("a@example.com");
    expect(MARKETING_CHANNEL_ADAPTERS.sms.recipientOf(customer)).toBe("0900000000");
  });
});
