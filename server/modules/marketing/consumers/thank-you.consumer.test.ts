import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  companyNameOf: vi.fn(),
  customerFindOne: vi.fn(),
  getMarketingSettings: vi.fn(),
  queueAndSend: vi.fn(),
  registerDomainConsumer: vi.fn(),
  resolveMarketingAttachments: vi.fn(),
  resolveSendableChannel: vi.fn(),
}));

vi.mock("../../../integrations/shared/event-bus", () => ({
  registerDomainConsumer: mocks.registerDomainConsumer,
}));
vi.mock("../../customer-management/models/customer.model", () => ({
  CustomerModel: { findOne: mocks.customerFindOne },
}));
vi.mock("../services/marketing-delivery.service", () => ({
  companyNameOf: mocks.companyNameOf,
  queueAndSend: mocks.queueAndSend,
  resolveSendableChannel: mocks.resolveSendableChannel,
}));
vi.mock("../services/marketing-invoice-attachment.service", () => ({
  resolveMarketingAttachments: mocks.resolveMarketingAttachments,
}));
vi.mock("../services/marketing-settings.service", () => ({
  getMarketingSettings: mocks.getMarketingSettings,
}));

const { sendThankYouForOrder } = await import("./thank-you.consumer");

const adapter = {
  channel: "email",
  label: "Email",
  implemented: true,
  supportsAttachments: true,
  isConfigured: vi.fn(),
  recipientOf: vi.fn(),
  send: vi.fn(),
};
const event = {
  companyCode: "igen",
  branchId: "branch-1",
  payload: {
    orderId: "order-1",
    orderCode: "HD-001",
    customerId: "customer-1",
    customerName: "Khách A",
    grandTotal: 100_000,
    branchId: "branch-1",
  },
};
const attachmentRef = {
  kind: "retail-invoice",
  orderId: "order-1",
  branchId: "branch-1",
};

describe("sendThankYouForOrder invoice attachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.customerFindOne.mockReturnValue({
      lean: async () => ({
        _id: "customer-1",
        companyCode: "IGEN",
        name: "Khách A",
        email: "customer@example.com",
        status: "active",
      }),
    });
    mocks.getMarketingSettings.mockResolvedValue({
      attachInvoicePdf: true,
      thank_you: {
        enabled: true,
        channels: ["email"],
        subject: "Cảm ơn",
        html: "<p>Cảm ơn</p>",
      },
    });
    mocks.resolveSendableChannel.mockResolvedValue(adapter);
    mocks.companyNameOf.mockResolvedValue("Igen Tech");
    mocks.queueAndSend.mockResolvedValue({ status: "sent" });
  });

  it("chuyển PDF hóa đơn sang hàng đợi gửi email khi setting được bật", async () => {
    const attachments = [
      { filename: "HD-001.pdf", content: Buffer.from("pdf"), contentType: "application/pdf" },
    ];
    mocks.resolveMarketingAttachments.mockResolvedValue(attachments);

    await sendThankYouForOrder(event);

    expect(mocks.resolveMarketingAttachments).toHaveBeenCalledWith("igen", attachmentRef);
    expect(mocks.queueAndSend).toHaveBeenCalledWith(expect.objectContaining({ attachments, attachmentRef }));
  });

  it("gửi email bình thường mà không dựng PDF khi setting bị tắt", async () => {
    mocks.getMarketingSettings.mockResolvedValue({
      attachInvoicePdf: false,
      thank_you: {
        enabled: true,
        channels: ["email"],
        subject: "Cảm ơn",
        html: "<p>Cảm ơn</p>",
      },
    });

    await sendThankYouForOrder(event);

    expect(mocks.resolveMarketingAttachments).not.toHaveBeenCalled();
    expect(mocks.queueAndSend).toHaveBeenCalledWith(expect.objectContaining({
      attachments: undefined,
      attachmentRef: undefined,
    }));
  });

  it("không gửi email thiếu PDF khi setting đính kèm được bật", async () => {
    mocks.resolveMarketingAttachments.mockResolvedValue([]);

    await expect(sendThankYouForOrder(event)).rejects.toThrow("MARKETING_INVOICE_ATTACHMENT_NOT_READY");
    expect(mocks.queueAndSend).not.toHaveBeenCalled();
  });
});
