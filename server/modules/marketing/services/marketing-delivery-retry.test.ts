import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
  resolveMarketingAttachments: vi.fn(),
  send: vi.fn(),
}));

vi.mock("../models/marketing-delivery.model", () => ({
  MarketingDeliveryModel: {
    findOneAndUpdate: mocks.findOneAndUpdate,
    updateOne: mocks.updateOne,
  },
}));
vi.mock("./marketing-invoice-attachment.service", () => ({
  resolveMarketingAttachments: mocks.resolveMarketingAttachments,
}));
vi.mock("./marketing-channels", () => ({
  MARKETING_CHANNEL_ADAPTERS: {
    email: {
      channel: "email",
      implemented: true,
      supportsAttachments: true,
      send: mocks.send,
    },
    sms: {
      channel: "sms",
      implemented: true,
      supportsAttachments: false,
      send: mocks.send,
    },
  },
  resolveSendableChannel: vi.fn(),
}));

const { retryDelivery } = await import("./marketing-delivery.service");

const attachmentRef = { kind: "retail-invoice" as const, orderId: "order-1", branchId: "branch-1" };
const failedDelivery = (overrides: Record<string, unknown> = {}) => ({
  _id: "delivery-1",
  channel: "email",
  recipient: "customer@example.com",
  subject: "Cảm ơn",
  body: "<p>Cảm ơn</p>",
  ...overrides,
});

describe("retryDelivery attachments", () => {
  beforeEach(() => {
    mocks.findOneAndUpdate.mockReset();
    mocks.updateOne.mockReset();
    mocks.resolveMarketingAttachments.mockReset();
    mocks.send.mockReset();
    mocks.findOneAndUpdate.mockReturnValue({ lean: async () => failedDelivery({ attachmentRef }) });
    mocks.resolveMarketingAttachments.mockResolvedValue([
      { filename: "HD-001.pdf", content: Buffer.from("pdf"), contentType: "application/pdf" },
    ]);
    mocks.send.mockResolvedValue({ messageId: "message-1" });
  });

  it("tái dựng và gửi lại PDF khi delivery có attachment reference", async () => {
    await expect(retryDelivery("igen", "delivery-1")).resolves.toEqual({ status: "sent" });
    expect(mocks.resolveMarketingAttachments).toHaveBeenCalledWith("igen", attachmentRef);
    expect(mocks.send).toHaveBeenCalledWith("igen", expect.objectContaining({
      attachments: [{ filename: "HD-001.pdf", content: Buffer.from("pdf"), contentType: "application/pdf" }],
    }));
  });

  it("giữ delivery cũ không có trường attachments", async () => {
    mocks.findOneAndUpdate.mockReturnValue({ lean: async () => failedDelivery({ attachmentRef: null }) });
    await retryDelivery("igen", "delivery-1");
    expect(mocks.resolveMarketingAttachments).not.toHaveBeenCalled();
    expect(mocks.send.mock.calls[0][1]).not.toHaveProperty("attachments");
  });

  it("không dựng attachment cho kênh không hỗ trợ", async () => {
    mocks.findOneAndUpdate.mockReturnValue({ lean: async () => failedDelivery({ channel: "sms", attachmentRef }) });
    await retryDelivery("igen", "delivery-1");
    expect(mocks.resolveMarketingAttachments).not.toHaveBeenCalled();
    expect(mocks.send.mock.calls[0][1]).not.toHaveProperty("attachments");
  });
});
