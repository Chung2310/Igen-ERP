import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  getSettings: vi.fn(),
  renderPdf: vi.fn(),
  consoleError: vi.spyOn(console, "error").mockImplementation(() => undefined),
}));

vi.mock("../../retail/models/retail-invoice.model", () => ({ RetailInvoiceModel: { findOne: mocks.findOne } }));
vi.mock("../../retail/services/retail-settings.service", () => ({ getResolvedRetailSettings: mocks.getSettings }));
vi.mock("../../retail/services/retail-invoice-pdf.service", () => ({ renderRetailInvoicePdf: mocks.renderPdf }));

const { MARKETING_ATTACHMENT_MAX_BYTES, resolveMarketingAttachments } = await import("./marketing-invoice-attachment.service");

describe("marketing invoice attachment", () => {
  beforeEach(() => {
    mocks.findOne.mockReset();
    mocks.getSettings.mockReset();
    mocks.renderPdf.mockReset();
    mocks.consoleError.mockClear();
    mocks.findOne.mockReturnValue({ lean: async () => ({ branchId: "branch-1" }) });
    mocks.getSettings.mockResolvedValue({ invoicePaperSize: "A4" });
  });

  it("bỏ PDF vượt giới hạn để email vẫn được gửi", async () => {
    mocks.renderPdf.mockResolvedValue({ buffer: Buffer.alloc(MARKETING_ATTACHMENT_MAX_BYTES + 1), filename: "HD-001.pdf" });
    await expect(resolveMarketingAttachments("igen", { kind: "retail-invoice", orderId: "order-1", branchId: "branch-1" })).resolves.toEqual([]);
    expect(mocks.consoleError).toHaveBeenCalled();
  });

  it("trả mảng rỗng khi không có hóa đơn đã issued", async () => {
    mocks.findOne.mockReturnValue({ lean: async () => null });
    await expect(resolveMarketingAttachments("igen", { kind: "retail-invoice", orderId: "order-1", branchId: "branch-1" })).resolves.toEqual([]);
  });

  it("trả attachment PDF với tên tệp và content type từ hóa đơn", async () => {
    mocks.renderPdf.mockResolvedValue({ buffer: Buffer.from("pdf"), filename: "HD-001.pdf" });
    await expect(resolveMarketingAttachments("igen", { kind: "retail-invoice", orderId: "order-1", branchId: "branch-1" })).resolves.toEqual([
      { filename: "HD-001.pdf", content: Buffer.from("pdf"), contentType: "application/pdf" },
    ]);
  });

  it("bỏ qua reference không nhận diện để email retry không bị chặn", async () => {
    await expect(resolveMarketingAttachments("igen", { kind: "unknown" } as any)).resolves.toEqual([]);
    expect(mocks.consoleError).toHaveBeenCalled();
  });
});
