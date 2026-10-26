// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    expect(await screen.findAllByText("BARCODE-SAVED · IMEI-SAVED")).toHaveLength(1);
    expect(inventorySerialService.list).toHaveBeenCalledWith(expect.objectContaining({ barcodes: ["BARCODE-SAVED"] }));
  });
describe("StockLogPanel", () => {
  async function editTrackedDraft(identifiers: string[] = [], serialNumbers = identifiers.length ? ["SER-OLD"] : []) {
    const { inventoryReceivingService } = await import("../../services/inventoryReceivingService");
    vi.mocked(inventoryReceivingService.listWarehouses).mockResolvedValue([
      { _id: "w1", branchId: "branch", code: "MAIN", name: "Kho chính", kind: "storage", isDefault: true, isActive: true },
      { _id: "w2", branchId: "branch", code: "OTHER", name: "Kho phụ", kind: "storage", isDefault: false, isActive: true },
    ]);
    vi.mocked(inventoryReceivingService.listBalances).mockResolvedValue([
      { _id: "b1", warehouseId: "w1", productId: "p1", variantId: "serial", sku: "SERIAL", productName: "Sản phẩm", trackingMode: "serial", quantity: 5, reservedQuantity: 0, averageCost: 10 },
      { _id: "b2", warehouseId: "w1", productId: "p1", variantId: "bulk", sku: "BULK", productName: "Sản phẩm", trackingMode: "quantity", quantity: 5, reservedQuantity: 0, averageCost: 10 },
    ]);
    const update = vi.fn(async () => undefined);
    render(<StockLogPanel products={[]} searchLog="" setSearchLog={vi.fn()}
      stockLogs={[{ id: "pending-tracked", warehouseId: "w1", type: "xuất", purpose: "nội bộ", title: "Xuất nội bộ", sku: "SERIAL", productName: "Sản phẩm", quantity: 1, operatorName: "Tester", createdAt: "2026-01-01", notes: "", status: "Đang chờ",
        items: [{ productId: "p1", variantId: "serial", sku: "SERIAL", productName: "Sản phẩm", quantity: 1, unitIdentifiers: identifiers, serialNumbers }],
      } as any]} onExportExcel={vi.fn()} onImportExcel={vi.fn()} onNavigateToCreateProduct={vi.fn()}
      onCreateTransaction={vi.fn()} onUpdateTransaction={update} outboundOnly />);
    fireEvent.click(await screen.findByRole("button", { name: /Sửa phiếu/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "SKU / biến thể dòng 1" }).textContent).toContain("SERIAL"));
    return update;
  }

  it("saves an incomplete tracked draft without requiring unit assignment", async () => {
    const update = await editTrackedDraft();
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật phiếu" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "Đang chờ" })));
  });

  it("still requires unit assignment before completing a tracked outbound document", async () => {
    const update = await editTrackedDraft();
    fireEvent.click(screen.getByRole("button", { name: "Trạng thái phiếu" }));
    fireEvent.click(screen.getByRole("option", { name: "Hoàn thành" }));
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật phiếu" }));
    expect(update).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("chọn đủ mã đơn vị"));
  });

  it("preserves serial-only identifiers when completing an older draft", async () => {
    const update = await editTrackedDraft([], ["SER-OLD"]);
    fireEvent.click(screen.getByRole("button", { name: "Trạng thái phiếu" }));
    fireEvent.click(screen.getByRole("option", { name: "Hoàn thành" }));
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật phiếu" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "Hoàn thành", items: [expect.objectContaining({ serialNumbers: ["SER-OLD"] })] })));
  });

  it("clears old unit identifiers when switching a draft line to a quantity SKU", async () => {
    const update = await editTrackedDraft(["UNIT-OLD"]);
    fireEvent.click(screen.getByRole("button", { name: "SKU / biến thể dòng 1" }));
    fireEvent.click(screen.getByRole("option", { name: /BULK/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật phiếu" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ sku: "BULK", unitIdentifiers: [], serialNumbers: [] })] })));
  });

  it("clears unit selection when changing the source warehouse", async () => {
    const update = await editTrackedDraft(["UNIT-OLD"]);
    fireEvent.click(screen.getByRole("button", { name: "Xuất từ kho" }));
    fireEvent.click(screen.getByRole("option", { name: "Kho phụ" }));
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật phiếu" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ warehouseId: "w2", items: [expect.objectContaining({ unitIdentifiers: [], serialNumbers: [] })] })));
  });

  it.each(["Hoàn thành", "Thành công"])("only offers read access for posted stock documents (%s)", (status) => {
    render(<StockLogPanel products={[]} searchLog="" setSearchLog={vi.fn()}
      stockLogs={[{ id: "posted", type: "xuất", sku: "PAPER", productName: "Giấy A4", quantity: 1,
        operatorName: "Tester", createdAt: "2026-01-01", notes: "", status } as any]}
      onExportExcel={vi.fn()} onImportExcel={vi.fn()} onNavigateToCreateProduct={vi.fn()}
      onCreateTransaction={vi.fn()} onUpdateTransaction={vi.fn()} onUpdateStatus={vi.fn()} onDeleteTransaction={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Xem chi tiết/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sửa phiếu" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xóa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Trạng thái posted" })).toBeNull();
  });

  it("keeps stock transfers in the receiving workflow instead of manual stock logs", async () => {
    await editTrackedDraft();
    fireEvent.click(screen.getByRole("button", { name: "Mục đích xuất kho" }));
    expect(screen.queryByRole("option", { name: /Điều chuyển/ })).toBeNull();
  });

  it("keeps quantity-only stock documents free of serial fields", async () => {
    render(<StockLogPanel products={[]} searchLog="" setSearchLog={vi.fn()}
      stockLogs={[{ id: "quantity-log", type: "xuất", title: "Xuất giấy", sku: "PAPER", productName: "Giấy A4", quantity: 2,
        operatorName: "Tester", createdAt: "2026-01-01", notes: "", status: "Đang chờ",
        items: [{ productId: "paper", sku: "PAPER", productName: "Giấy A4", quantity: 2 }],
      }]}
      onExportExcel={vi.fn()} onImportExcel={vi.fn()} onNavigateToCreateProduct={vi.fn()}
      onCreateTransaction={vi.fn()} onUpdateTransaction={vi.fn()} outboundOnly />);
    fireEvent.click(screen.getByRole("button", { name: /Xem chi tiết/ }));
    expect(screen.queryByRole("columnheader", { name: /sê-ri|IMEI/i })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "SKU" })).toBeTruthy();
  });

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
    expect(screen.getByRole("columnheader", { name: "Số sê-ri / Mã đơn vị" })).toBeTruthy();
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
    expect(screen.getByRole("columnheader", { name: "Số sê-ri / Mã đơn vị" })).toBeTruthy();
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
});
