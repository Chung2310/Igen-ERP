// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { formatVndWords, printReceiptVoucher } from "./printReceiptVoucher";
import type { GoodsReceipt } from "../../../services/inventoryReceivingService";

describe("printReceiptVoucher", () => {
  describe("formatVndWords", () => {
    it("should format 0 as Không đồng", () => {
      expect(formatVndWords(0)).toBe("Không đồng");
    });

    it("should format 456,000,000 correctly", () => {
      expect(formatVndWords(456_000_000)).toBe("Bốn trăm năm mươi sáu triệu đồng chẵn");
    });

    it("should format 228,000,000 correctly", () => {
      expect(formatVndWords(228_000_000)).toBe("Hai trăm hai mươi tám triệu đồng chẵn");
    });

    it("should format 19,000,000 correctly", () => {
      expect(formatVndWords(19_000_000)).toBe("Mười chín triệu đồng chẵn");
    });

    it("should format numbers with irregular units (1, 5)", () => {
      expect(formatVndWords(1_222_221)).toBe("Một triệu hai trăm hai mươi hai nghìn hai trăm hai mươi mốt đồng chẵn");
      expect(formatVndWords(15_000_000)).toBe("Mười lăm triệu đồng chẵn");
      expect(formatVndWords(25_000)).toBe("Hai mươi lăm nghìn đồng chẵn");
    });
  });

  describe("printReceiptVoucher execution", () => {
    it("should create hidden iframe and trigger print", () => {
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

      const sampleReceipt: GoodsReceipt = {
        _id: "r1",
        receiptCode: "PN-MAIN-20260923-0001",
        supplierId: "s1",
        supplierName: "Nhà Cung Cấp Apple VN",
        warehouseId: "w1",
        status: "confirmed",
        items: [
          {
            productId: "p1",
            variantId: "v1",
            sku: "SKU-DEN-BLACK-128GB",
            productName: "IP 16pro",
            displayName: "Đen (Black) · 128GB · Cũ 98% Đẹp",
            quantity: 12,
            unitCost: 19_000_000,
            lineTotal: 228_000_000,
            trackingMode: "serial",
            serialNumbers: ["IMEI1", "IMEI2"],
          },
        ],
        subtotal: 228_000_000,
        createdAt: "2026-09-23T02:00:00.000Z",
      };

      printReceiptVoucher({
        receipt: sampleReceipt,
        includeSerials: true,
      });

      expect(mockOpen).toHaveBeenCalled();
      expect(mockWrite).toHaveBeenCalled();
      const writtenHtml = mockWrite.mock.calls[0][0];
      expect(writtenHtml).toContain("PHIẾU NHẬP KHO");
      expect(writtenHtml).toContain("PN-MAIN-20260923-0001");
      expect(writtenHtml).toContain("Nhà Cung Cấp Apple VN");
      expect(writtenHtml).toContain("Đen (Black) · 128GB · Cũ 98% Đẹp");
      expect(writtenHtml).toContain("IMEI1");
      expect(writtenHtml).toContain("228.000.000");
      expect(mockClose).toHaveBeenCalled();
    });
  });
});
