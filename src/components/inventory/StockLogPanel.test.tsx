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

vi.mock("../../pages/Toast", () => ({
  toast: { error: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StockLogPanel", () => {
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
