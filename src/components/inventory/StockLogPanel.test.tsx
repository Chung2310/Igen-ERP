// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StockLogPanel } from "./StockLogPanel";

vi.mock("./StockOperatorPicker", () => ({
  StockOperatorPicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input aria-label="Người phụ trách" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

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

    expect(screen.getByText("Vui lòng nhập tên phiếu, chọn người phụ trách và thêm ít nhất một sản phẩm.")).toBeTruthy();
  });
});
