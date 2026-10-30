// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { printInventoryCountVoucher } from "./printInventoryCountVoucher";
import type { InventoryCount } from "../../services/inventoryCountService";

describe("printInventoryCountVoucher", () => {
  it("should generate A4 inventory count voucher HTML and trigger print in iframe", () => {
    const mockWrite = vi.fn();
    const mockOpen = vi.fn();
    const mockClose = vi.fn();
    const mockPrint = vi.fn();
    const mockFocus = vi.fn();

    const fakeIframe = {
      style: {},
      contentWindow: {
        document: {
          open: mockOpen,
          write: mockWrite,
          close: mockClose,
        },
        focus: mockFocus,
        print: mockPrint,
      },
    } as any;

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "iframe") return fakeIframe;
      return originalCreateElement(tag);
    });
    vi.spyOn(document.body, "appendChild").mockImplementation(() => fakeIframe);

    const sampleCount: InventoryCount = {
      _id: "c1",
      version: 0,
      countCode: "KK-MUDHSALJ-3ABZ",
      warehouseId: "w1",
      status: "counting",
      createdAt: "2026-09-23T02:00:00.000Z",
      items: [
        {
          _id: "i1",
          productId: "p1",
          sku: "SKU-DEN-BLACK-128GB",
          productName: "IP 16pro - Đen (Black) - 128GB - Cũ 98% Đẹp",
          systemQuantity: 12,
          countedQuantity: 12,
          quantityDelta: 0,
          trackingMode: "serial",
        },
        {
          _id: "i2",
          productId: "p2",
          sku: "SKU-TÍM",
          productName: "IP 15 - Tím",
          systemQuantity: 11,
          countedQuantity: 10,
          quantityDelta: -1,
          trackingMode: "quantity",
        },
      ],
    };

    printInventoryCountVoucher({
      count: sampleCount,
      warehouseName: "Kho bán hàng - Trụ sở chính",
    });

    expect(mockOpen).toHaveBeenCalled();
    expect(mockWrite).toHaveBeenCalled();
    const writtenHtml = mockWrite.mock.calls[0][0];
    expect(writtenHtml).toContain("BIÊN BẢN KIỂM KÊ HÀNG HÓA");
    expect(writtenHtml).toContain("KK-MUDHSALJ-3ABZ");
    expect(writtenHtml).toContain("Kho bán hàng - Trụ sở chính");
    expect(writtenHtml).toContain("SKU-DEN-BLACK-128GB");
    expect(writtenHtml).toContain("SKU-TÍM");
    expect(writtenHtml).toContain("-1");
    expect(mockClose).toHaveBeenCalled();
  });
});
