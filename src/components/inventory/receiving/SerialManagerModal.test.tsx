// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SerialManagerModal } from "./SerialManagerModal";

const { allocateInternalBarcodes, printLabels } = vi.hoisted(() => ({
  allocateInternalBarcodes: vi.fn(),
  printLabels: vi.fn(),
}));

vi.mock("../../../services/inventorySerialService", () => ({
  inventorySerialService: { allocateInternalBarcodes },
}));

vi.mock("./printDeviceBarcodeLabels", () => ({
  printDeviceBarcodeLabels: printLabels,
}));

vi.mock("../../../pages/Toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const line = {
  key: "line-1",
  displayName: "Device model",
  productId: "product-1",
  variantId: "variant-1",
  sku: "SKU-1",
  productName: "Device model",
  quantity: 1,
  unitCost: 1,
  trackingMode: "serial" as const,
  serialNumbers: [],
  unitDetails: [],
};

function renderModal() {
  return render(
    <React.StrictMode>
      <SerialManagerModal
        isOpen
        onClose={vi.fn()}
        line={line}
        onSave={vi.fn()}
        otherLinesSerials={[]}
      />
    </React.StrictMode>,
  );
}

describe("SerialManagerModal", () => {
  beforeEach(() => {
    allocateInternalBarcodes.mockResolvedValue(["DVU000000000123"]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps optional IMEIs collapsed, allocates a barcode in Strict Mode, and prints the entered device identifiers", async () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /Danh sách chi tiết/ }));
    expect(screen.queryByLabelText(/IMEI 1 \(nếu có\)/)).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/serial\/IMEI #1/), { target: { value: "SN-001" } });
    fireEvent.click(screen.getByRole("button", { name: /Thêm IMEI phụ/ }));
    fireEvent.change(screen.getByPlaceholderText("Nhập IMEI 1"), { target: { value: "IMEI-001" } });

    fireEvent.click(screen.getByRole("button", { name: "Tự sinh mã còn thiếu" }));

    await waitFor(() => {
      expect((screen.getByLabelText("Mã quản lý thiết bị 1") as HTMLInputElement).value).toBe("DVU000000000123");
    });
    expect(allocateInternalBarcodes).toHaveBeenCalledWith(1);

    expect(screen.getAllByRole("button", { name: /In toàn bộ tem/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "In toàn bộ tem (1/1)" }));
    expect(printLabels).toHaveBeenCalledWith([
      expect.objectContaining({
        internalBarcode: "DVU000000000123",
        sku: "SKU-1",
        serialNumber: "SN-001",
        imei1: "IMEI-001",
      }),
    ]);
  });
});
