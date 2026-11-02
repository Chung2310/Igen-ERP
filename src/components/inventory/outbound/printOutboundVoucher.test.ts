// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatVndWords,
  purposeLabel,
  printOutboundVoucher,
  type OutboundTicket,
} from "./printOutboundVoucher";

describe("printOutboundVoucher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  describe("formatVndWords", () => {
    it("đọc số 0 là 'Không đồng'", () => {
      expect(formatVndWords(0)).toBe("Không đồng");
      expect(formatVndWords(-100)).toBe("Không đồng");
    });

    it("đọc đúng tiền chẵn hàng triệu", () => {
      const words = formatVndWords(15000000);
      expect(words.toLowerCase()).toContain("mười lăm triệu");
      expect(words).toContain("đồng chẵn");
    });

    it("đọc đúng tiền lẻ hàng trăm nghìn", () => {
      const words = formatVndWords(25500000);
      expect(words.toLowerCase()).toContain("hai mươi lăm triệu");
      expect(words.toLowerCase()).toContain("năm trăm nghìn");
      expect(words).toContain("đồng chẵn");
    });
  });

  describe("purposeLabel", () => {
    it("chuyển đổi mã mục đích sang nhãn tiếng Việt rõ ràng", () => {
      expect(purposeLabel("chuyển kho")).toBe("Điều chuyển kho sang cơ sở khác");
      expect(purposeLabel("nội bộ")).toBe("Xuất cho nhân viên nội bộ sử dụng");
      expect(purposeLabel("hủy")).toBe("Xuất hủy / lỗi / bảo hành");
      expect(purposeLabel(undefined)).toBe("Xuất kho");
    });
  });

  describe("printOutboundVoucher execution", () => {
    it("marks a reversed voucher as historical rather than an active issue", () => {
      printOutboundVoucher({ ticket: { id: "s1", reversalId: "r1", createdAt: "2026-09-29", items: [] } });
      expect(document.querySelector("iframe")?.contentWindow?.document.body.textContent).toContain("ĐÃ ĐẢO TOÀN BỘ");
    });
    it("tạo iframe ẩn và nạp nội dung phiếu xuất kho hoàn chỉnh", () => {
      const ticket: OutboundTicket = {
        id: "XK-2026-001",
        title: "Điều chuyển kho sang cơ sở Hà Nội",
        createdAt: "2026-09-23T10:00:00Z",
        purpose: "chuyển kho",
        customerName: "Kho Chi nhánh Hà Nội",
        operatorName: "Trần Thủ Kho",
        notes: "Giao gấp buổi sáng",
        items: [
          {
            sku: "IP15-128-BLK",
            productName: "iPhone 15 128GB Đen",
            quantity: 2,
            unitPrice: 20000000,
            lineTotal: 40000000,
            serialNumbers: ["IMEI-001", "IMEI-002"],
            unitDetails: [
              { internalBarcode: "NB-001" },
              { internalBarcode: "NB-002" },
            ],
          },
        ],
      };

      const warehouse = {
        _id: "wh-1",
        code: "KHO-TONG",
        name: "Kho Tổng TP.HCM",
        address: "123 Cách Mạng Tháng 8, Q.3",
        branchId: "branch-1",
        kind: "storage" as const,
        isActive: true,
        isDefault: true,
      };

      printOutboundVoucher({
        ticket,
        warehouse,
        includeSerials: true,
      });

      const iframe = document.querySelector("iframe");
      expect(iframe).not.toBeNull();
      expect(iframe?.style.visibility).toBe("hidden");

      const doc = iframe?.contentWindow?.document;
      expect(doc?.body.innerHTML).toContain("PHIẾU XUẤT KHO");
      expect(doc?.body.innerHTML).toContain("XK-2026-001");
      expect(doc?.body.innerHTML).toContain("Kho Tổng TP.HCM");
      expect(doc?.body.innerHTML).toContain("Kho Chi nhánh Hà Nội");
      expect(doc?.body.innerHTML).toContain("Trần Thủ Kho");
      expect(doc?.body.innerHTML).toContain("iPhone 15 128GB Đen");
      expect(doc?.body.innerHTML).toContain("IP15-128-BLK");
      expect(doc?.body.innerHTML).toContain("IMEI-001");
      expect(doc?.body.innerHTML).toContain("IMEI-002");
      expect(doc?.body.innerHTML).toContain("NB-001");
      expect(doc?.body.innerHTML).toContain("Bốn mươi triệu");
    });
  });
});
