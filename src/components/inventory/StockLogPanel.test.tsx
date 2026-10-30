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
        stockLogs={[{ id: "log-detail", type: "xuất", title: "Phiếu xuất", sku: "SKU-1", productName: "Sản phẩm 1", quantity: 1, operatorName: "Người dùng", createdAt: "2026-01-01", notes: "", status: "Đang chờ", items: [{ productId: "product-1", sku: "SKU-1", productName: "Sản phẩm 1", quantity: 1, unitIdentifiers: ["BARCODE-1"], serialNumbers: ["IMEI-1"] }] }]}
        onExportExcel={vi.fn()}
        onImportExcel={vi.fn()}
        onNavigateToCreateProduct={vi.fn()}
        onCreateTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Xem chi tiết/ }));

    expect(screen.getByText("Hàng xuất")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "IMEI / Serial" })).toBeTruthy();
    expect(screen.getByText("SKU-1")).toBeTruthy();
    expect(screen.getByText("IMEI-1")).toBeTruthy();
  });

  it("hiển thị hàng xuất theo từng SKU và IMEI trong bảng chi tiết", () => {
    render(
      <StockLogPanel
        products={[]}
        searchLog=""
        setSearchLog={vi.fn()}
        stockLogs={[{ id: "log-outbound-items", type: "xuất", title: "Phiếu xuất", sku: "SKU-1", productName: "Sản phẩm 1", quantity: 2, operatorName: "Người dùng", createdAt: "2026-01-01", notes: "", status: "Đang chờ", items: [
          { productId: "product-1", sku: "SKU-1", productName: "Sản phẩm 1", quantity: 1, serialNumbers: ["IMEI-1"] },
          { productId: "product-2", sku: "SKU-2", productName: "Sản phẩm 2", quantity: 1, serialNumbers: ["IMEI-2"] },
        ] }]}
        onExportExcel={vi.fn()}
        onImportExcel={vi.fn()}
        onNavigateToCreateProduct={vi.fn()}
        onCreateTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Xem chi tiết/ }));

    expect(screen.getByText("Hàng xuất")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "SKU" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "IMEI / Serial" })).toBeTruthy();
    expect(screen.getByText("SKU-1")).toBeTruthy();
    expect(screen.getByText("SKU-2")).toBeTruthy();
    expect(screen.getByText("IMEI-1")).toBeTruthy();
    expect(screen.getByText("IMEI-2")).toBeTruthy();
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

  it("nhận diện và hiển thị rõ ràng giao dịch bán lẻ POS với huy hiệu Bán POS", () => {
    render(
      <StockLogPanel
        products={[]}
        searchLog=""
        setSearchLog={vi.fn()}
        stockLogs={[
          {
            id: "pos-log-01",
            type: "xuất",
            purpose: "bán",
            title: "Bán hàng POS: Đơn #HD1001",
            sku: "IPHONE-15",
            productName: "iPhone 15 Pro",
            quantity: 1,
            operatorName: "Thu ngân Mai",
            createdAt: "2026-03-20T10:00:00Z",
            notes: "Bán lẻ tại quầy",
            status: "Hoàn thành",
            items: [
              {
                productId: "prod-1",
                sku: "IPHONE-15",
                productName: "iPhone 15 Pro",
                quantity: 1,
              },
            ],
          },
        ]}
        onExportExcel={vi.fn()}
        onImportExcel={vi.fn()}
        onNavigateToCreateProduct={vi.fn()}
        onCreateTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
      />
    );

    expect(screen.getAllByText("Bán POS").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Bán lẻ tại quầy")).toBeTruthy();
    expect(screen.getByText("Bán hàng POS: Đơn #HD1001")).toBeTruthy();
  });

  it("lọc đúng danh sách khi bấm vào tab Bán POS", () => {
    render(
      <StockLogPanel
        products={[]}
        searchLog=""
        setSearchLog={vi.fn()}
        stockLogs={[
          {
            id: "inbound-01",
            type: "nhập",
            title: "Nhập hàng nhà cung cấp",
            sku: "SKU-IN",
            productName: "Sản phẩm nhập",
            quantity: 5,
            operatorName: "Thủ kho",
            createdAt: "2026-03-20T08:00:00Z",
            notes: "",
            status: "Hoàn thành",
          },
          {
            id: "pos-02",
            type: "xuất",
            purpose: "bán",
            title: "Bán POS #200",
            sku: "SKU-POS",
            productName: "Sản phẩm bán POS",
            quantity: 1,
            operatorName: "Thu ngân",
            createdAt: "2026-03-20T09:00:00Z",
            notes: "",
            status: "Hoàn thành",
          },
        ]}
        onExportExcel={vi.fn()}
        onImportExcel={vi.fn()}
        onNavigateToCreateProduct={vi.fn()}
        onCreateTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
      />
    );

    // Initial state: both logs appear
    expect(screen.getByText("Nhập hàng nhà cung cấp")).toBeTruthy();
    expect(screen.getByText("Bán POS #200")).toBeTruthy();

    // Click Bán POS pill
    fireEvent.click(screen.getByRole("button", { name: /Bán POS/ }));

    // Inbound is filtered out, POS is kept
    expect(screen.queryByText("Nhập hàng nhà cung cấp")).toBeNull();
    expect(screen.getByText("Bán POS #200")).toBeTruthy();
  });

  it("lọc giao dịch theo khoảng ngày tùy chọn (custom date range)", () => {
    render(
      <StockLogPanel
        products={[]}
        searchLog=""
        setSearchLog={vi.fn()}
        stockLogs={[
          {
            id: "log-jan",
            type: "nhập",
            title: "Phiếu tháng 1",
            sku: "SKU-JAN",
            productName: "Sản phẩm tháng 1",
            quantity: 2,
            operatorName: "Thủ kho",
            createdAt: "2026-01-15T08:00:00Z",
            notes: "",
            status: "Hoàn thành",
          },
          {
            id: "log-mar",
            type: "xuất",
            title: "Phiếu tháng 3",
            sku: "SKU-MAR",
            productName: "Sản phẩm tháng 3",
            quantity: 1,
            operatorName: "Thủ kho",
            createdAt: "2026-03-20T08:00:00Z",
            notes: "",
            status: "Hoàn thành",
          },
        ]}
        onExportExcel={vi.fn()}
        onImportExcel={vi.fn()}
        onNavigateToCreateProduct={vi.fn()}
        onCreateTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
      />
    );

    // Initial: both visible
    expect(screen.getByText("Phiếu tháng 1")).toBeTruthy();
    expect(screen.getByText("Phiếu tháng 3")).toBeTruthy();

    // Enter date range for March only: 2026-03-01 to 2026-03-31 directly
    const fromInput = screen.getByLabelText("Từ ngày");
    const toInput = screen.getByLabelText("Đến ngày");
    fireEvent.change(fromInput, { target: { value: "2026-03-01" } });
    fireEvent.change(toInput, { target: { value: "2026-03-31" } });

    // Jan ticket is filtered out, Mar ticket remains
    expect(screen.queryByText("Phiếu tháng 1")).toBeNull();
    expect(screen.getByText("Phiếu tháng 3")).toBeTruthy();
  });

  it("nhập trực tiếp 'Từ ngày' và 'Đến ngày' để lọc khoảng thời gian tùy ý", () => {
    render(
      <StockLogPanel
        products={[]}
        searchLog=""
        setSearchLog={vi.fn()}
        stockLogs={[
          {
            id: "log-1",
            type: "nhập",
            title: "Giao dịch ngày 10/03",
            sku: "SKU-A",
            productName: "Sản phẩm A",
            quantity: 1,
            operatorName: "Thủ kho",
            createdAt: "2026-03-10T08:00:00Z",
            notes: "",
            status: "Hoàn thành",
          },
          {
            id: "log-2",
            type: "xuất",
            title: "Giao dịch ngày 25/03",
            sku: "SKU-B",
            productName: "Sản phẩm B",
            quantity: 1,
            operatorName: "Thủ kho",
            createdAt: "2026-03-25T08:00:00Z",
            notes: "",
            status: "Hoàn thành",
          },
        ]}
        onExportExcel={vi.fn()}
        onImportExcel={vi.fn()}
        onNavigateToCreateProduct={vi.fn()}
        onCreateTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
      />
    );

    const fromInput = screen.getByLabelText("Từ ngày") as HTMLInputElement;
    const toInput = screen.getByLabelText("Đến ngày") as HTMLInputElement;

    // Both dates are initially visible and empty
    expect(fromInput).toBeTruthy();
    expect(toInput).toBeTruthy();

    // Directly type date range: 2026-03-20 to 2026-03-31
    fireEvent.change(fromInput, { target: { value: "2026-03-20" } });
    fireEvent.change(toInput, { target: { value: "2026-03-31" } });

    // log-1 (10/03) is filtered out, log-2 (25/03) remains
    expect(screen.queryByText("Giao dịch ngày 10/03")).toBeNull();
    expect(screen.getByText("Giao dịch ngày 25/03")).toBeTruthy();
  });
});
