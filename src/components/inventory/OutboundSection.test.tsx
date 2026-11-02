// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OutboundSection } from "./OutboundSection";
import type { StockLog } from "../../types";

vi.mock("./StockOperatorPicker", () => ({
  StockOperatorPicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input aria-label="Người phụ trách" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock("../../services/inventoryReceivingService", () => ({
  inventoryReceivingService: {
    listWarehouses: vi.fn().mockResolvedValue([
      {
        _id: "wh-1",
        code: "KHO-HN",
        name: "Kho Hà Nội",
        branchId: "branch-1",
        kind: "storage",
        isDefault: true,
        isActive: true,
      },
    ]),
    listBalances: vi.fn().mockResolvedValue([
      {
        _id: "bal-1",
        warehouseId: "wh-1",
        productId: "prod-1",
        variantId: "var-1",
        sku: "IP15-BLK",
        productName: "iPhone 15 Đen",
        quantity: 10,
        reservedQuantity: 2,
        trackingMode: "serial",
      },
    ]),
  },
}));

vi.mock("../../services/inventorySerialService", () => ({
  inventorySerialService: {
    list: vi.fn().mockResolvedValue({
      items: [
        {
          _id: "unit-1",
          serialNumber: "356789012345678",
          internalBarcode: "NB-001",
          normalizedInternalBarcode: "NB-001",
          status: "in_stock",
          createdAt: "2026-01-01",
        },
      ],
      total: 1,
    }),
  },
}));

const mockStockLogs: StockLog[] = [
  {
    id: "XK-001",
    type: "xuất",
    purpose: "chuyển kho",
    title: "Điều chuyển iPhone sang cơ sở Hà Nội",
    customerName: "Kho Chi nhánh Hà Nội",
    sku: "IP15-BLK",
    productName: "iPhone 15 Đen",
    quantity: 2,
    operatorName: "Trần Quản Kho",
    createdAt: "2026-09-23T08:00:00Z",
    notes: "",
    status: "Đang chờ",
    warehouseId: "wh-1",
    items: [
      {
        productId: "prod-1",
        sku: "IP15-BLK",
        productName: "iPhone 15 Đen",
        quantity: 2,
        unitIdentifiers: ["NB-001", "NB-002"],
        serialNumbers: ["IMEI-111", "IMEI-222"],
      },
    ],
  },
  {
    id: "NK-002",
    type: "nhập",
    title: "Phiếu nhập không được hiện ở đây",
    sku: "IP15-WHT",
    productName: "iPhone 15 Trắng",
    quantity: 5,
    operatorName: "Người Nhập",
    notes: "",
    createdAt: "2026-09-22T08:00:00Z",
    status: "Hoàn thành",
  },
];

describe("OutboundSection", () => {
  it("excludes reversed and draft documents from issued quantity while preserving their history", async () => {
    const source = mockStockLogs[0];
    render(<OutboundSection stockLogs={[
      source,
      { ...source, id: "posted", status: "Hoàn thành" },
      { ...source, id: "reversed", status: "Hoàn thành", reversalId: "r1" } as any,
    ]} onCreateTransaction={vi.fn()} onUpdateTransaction={vi.fn()} />);
    await screen.findByText("reversed");
    expect(screen.getByText("Đã đảo toàn bộ")).toBeTruthy();
    expect(screen.getByText("Máy đã xuất (chưa đảo)").parentElement?.textContent).toContain("2");
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("chỉ hiển thị phiếu xuất hàng và các chỉ số KPI tương ứng", async () => {
    render(
      <OutboundSection
        stockLogs={mockStockLogs}
        onCreateTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
      />
    );

    // Phiếu xuất hiển thị
    expect(await screen.findByText("XK-001")).not.toBeNull();
    expect(screen.getByText("Kho Chi nhánh Hà Nội")).not.toBeNull();
    expect(screen.getByText("iPhone 15 Đen")).not.toBeNull();
    expect(screen.getByText("Điều chuyển kho sang cơ sở khác")).not.toBeNull();

    // Phiếu nhập bị lọc bỏ
    expect(screen.queryByText("NK-002")).toBeNull();
    expect(screen.queryByText("iPhone 15 Trắng")).toBeNull();
  });

  it("mở modal tạo phiếu xuất mới khi nhấn nút", async () => {
    render(
      <OutboundSection
        stockLogs={mockStockLogs}
        onCreateTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
      />
    );

    const createBtn = screen.getByRole("button", { name: /\+ Tạo phiếu xuất mới/i });
    fireEvent.click(createBtn);

    expect(await screen.findByText("Tạo phiếu xuất kho mới")).not.toBeNull();
    expect(screen.getByText(/1\. Thông tin xuất kho & Nơi nhận/i)).not.toBeNull();
  });

  it("mở chi tiết phiếu xuất và xem danh sách IMEI khi nhấn 'Chi tiết'", async () => {
    render(
      <OutboundSection
        stockLogs={mockStockLogs}
        onCreateTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
      />
    );

    const detailBtn = screen.getByRole("button", { name: "Chi tiết" });
    fireEvent.click(detailBtn);

    expect(await screen.findByText("Điều chuyển iPhone sang cơ sở Hà Nội")).not.toBeNull();
    expect(screen.getByText("IMEI-111")).not.toBeNull();
    expect(screen.getByText("IMEI-222")).not.toBeNull();
    expect(screen.getByRole("button", { name: "In phiếu xuất kho" })).not.toBeNull();
  });
});
