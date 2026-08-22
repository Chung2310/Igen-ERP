// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StockLogPanel } from "./StockLogPanel";
import { toast } from "../../pages/Toast";

vi.mock("./StockOperatorPicker", () => ({
  StockOperatorPicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input aria-label="Người phụ trách" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

vi.mock("./StockOutCustomerPicker", () => ({
  StockOutCustomerPicker: () => <div />,
}));

vi.mock("../../services/inventoryReceivingService", () => ({
  inventoryReceivingService: { listWarehouses: vi.fn().mockResolvedValue([]), listBalances: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../services/inventorySerialService", () => ({
  inventorySerialService: { list: vi.fn().mockResolvedValue({ items: [] }) },
}));

vi.mock("../../pages/Toast", () => ({
  toast: { error: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("loads saved IMEI when editing a pending outbound document", async () => {
    const { inventoryReceivingService } = await import("../../services/inventoryReceivingService");
    const { inventorySerialService } = await import("../../services/inventorySerialService");
    vi.mocked(inventoryReceivingService.listWarehouses).mockResolvedValue([{ _id: "warehouse-1", branchId: "branch", code: "MAIN", name: "Main", kind: "storage", isDefault: true, isActive: true }]);
    vi.mocked(inventoryReceivingService.listBalances).mockResolvedValue([{ _id: "balance-1", warehouseId: "warehouse-1", productId: "product-1", sku: "SKU-1", productName: "Product 1", quantity: 1, reservedQuantity: 0, averageCost: 0 }]);
    vi.mocked(inventorySerialService.list).mockImplementation(async (params: any) => ({
      items: params.barcodes?.includes("BARCODE-SAVED") ? [{ _id: "unit-1", companyCode: "company", branchId: "branch", productId: "product-1", sku: "SKU-1", productName: "Product 1", internalBarcode: "BARCODE-SAVED", normalizedInternalBarcode: "BARCODE-SAVED", serialNumber: "IMEI-SAVED", normalizedSerialNumber: "IMEI-SAVED", status: "sold", createdAt: "2026-01-01", updatedAt: "2026-01-01" }] : [],
      total: 1,
      page: 1,
      limit: 100,
    }));

    render(<StockLogPanel products={[{ id: "product-1", sku: "SKU-1", name: "Product 1", category: "", unit: "Piece", stock: 1, minStockAlert: 0, price: 0, status: "Active", demandForecast: "Ổn định", imageUrl: "" }]} searchLog="" setSearchLog={vi.fn()} stockLogs={[{ id: "log-1", type: "xuất", title: "Pending outbound", sku: "SKU-1", productName: "Product 1", quantity: 1, operatorName: "Operator", createdAt: "2026-01-01", notes: "", status: "Đang chờ", items: [{ productId: "product-1", sku: "SKU-1", productName: "Product 1", quantity: 1, unitIdentifiers: ["BARCODE-SAVED"] }] }]} onExportExcel={vi.fn()} onImportExcel={vi.fn()} onNavigateToCreateProduct={vi.fn()} onCreateTransaction={vi.fn()} onUpdateTransaction={vi.fn()} outboundOnly />);

    fireEvent.click(await screen.findByRole("button", { name: /Sửa phiếu/ }));
    fireEvent.click(screen.getByRole("button", { name: /Đã chọn 1 đơn vị/ }));

    expect(await screen.findAllByText("BARCODE-SAVED · IMEI-SAVED")).toHaveLength(2);
    expect(inventorySerialService.list).toHaveBeenCalledWith(expect.objectContaining({ barcodes: ["BARCODE-SAVED"] }));
  });
describe("StockLogPanel", () => {
  it("hiển thị SKU và IMEI đã lưu trong chi tiết phiếu xuất", () => {
    render(
      <StockLogPanel
        products={[]}
        searchLog=""
        setSearchLog={vi.fn()}
        stockLogs={[{ id: "log-detail", type: "xuất", title: "Phiếu xuất", sku: "SKU-1", productName: "Sản phẩm 1", quantity: 1, operatorName: "Người dùng", createdAt: "2026-01-01", notes: "", status: "Đang chờ", items: [{ productId: "product-1", sku: "SKU-1", productName: "Sản phẩm 1", quantity: 1, unitIdentifiers: ["BARCODE-1", "IMEI-1"] }] }]}
        onExportExcel={vi.fn()}
        onImportExcel={vi.fn()}
        onNavigateToCreateProduct={vi.fn()}
        onCreateTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Xem chi tiết/ }));

    expect(screen.getByText("Mã sản phẩm: SKU-1")).toBeTruthy();
    expect(screen.getByText("IMEI / mã vạch: BARCODE-1, IMEI-1")).toBeTruthy();
  });

  it("hiển thị lỗi khi bấm lưu phiếu nhưng thiếu các trường bắt buộc", () => {
    render(
      <StockLogPanel
        products={[]}
        searchLog=""
        setSearchLog={vi.fn()}
        stockLogs={[]}
        onExportExcel={vi.fn()}
        onImportExcel={vi.fn()}
        onNavigateToCreateProduct={vi.fn()}
        onCreateTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu phiếu" }));

    expect(toast.error).toHaveBeenCalledWith("Vui lòng nhập tên phiếu, chọn người phụ trách và thêm ít nhất một sản phẩm.");
  });

  it("hiển thị lỗi chọn kho thay vì để native validation chặn submit phiếu xuất", () => {
    render(
      <StockLogPanel
        products={[]}
        searchLog=""
        setSearchLog={vi.fn()}
        stockLogs={[]}
        onExportExcel={vi.fn()}
        onImportExcel={vi.fn()}
        onNavigateToCreateProduct={vi.fn()}
        onCreateTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
        outboundOnly
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu xuất" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu phiếu" }));

    expect(toast.error).toHaveBeenCalledWith("Vui lòng chọn kho xuất.");
  });
});
