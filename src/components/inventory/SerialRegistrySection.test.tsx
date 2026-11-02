// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SerialRegistrySection } from "./SerialRegistrySection";
import { inventorySerialService } from "../../services/inventorySerialService";

vi.mock("../../services/inventorySerialService", () => ({
  inventorySerialService: { list: vi.fn(), history: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(inventorySerialService.list).mockResolvedValue({
    items: [{
      _id: "serial-1", serialNumber: "IMEI-001", sku: "PHONE-1", productName: "Phone",
      status: "in_stock", updatedAt: "2026-08-21T00:00:00.000Z",
    }], total: 1, page: 1, limit: 100,
  } as never);
  vi.mocked(inventorySerialService.history).mockResolvedValue([
    { _id: "event-1", eventType: "received", toStatus: "in_stock", actorName: "Admin", occurredAt: "2026-08-21T00:00:00.000Z" },
  ] as never);
});

describe("SerialRegistrySection history", () => {
  afterEach(cleanup);
  it("shows internal allocation separately from sold stock with recipient and carrying cost", async () => {
    vi.mocked(inventorySerialService.list).mockResolvedValue({ items: [{ _id: "u", serialNumber: "IMEI-INTERNAL", sku: "PHONE", status: "internal_use", updatedAt: "2026-09-29", internalUse: { recipientName: "Phòng kỹ thuật", stockLogId: "ISSUE-1", issuedAt: "2026-09-29", unitCost: 1000000 } }], total: 1, page: 1, limit: 100 } as never);
    render(<SerialRegistrySection onTransfers={vi.fn()} />);
    await screen.findByText("IMEI-INTERNAL");
    expect(screen.getAllByText("Đang sử dụng nội bộ").length).toBeGreaterThan(0);
    expect(screen.getByText("Người nhận: Phòng kỹ thuật")).toBeTruthy();
    expect(screen.getByText(/Giá vốn cấp phát: 1.000.000/)).toBeTruthy();
    expect(screen.getByText("ISSUE-1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Chuyển" })).toBeNull();
  });
  it("opens history in a dialog and closes from the close control or backdrop", async () => {
    const { container } = render(<SerialRegistrySection />);
    await screen.findByText("IMEI-001");
    expect(screen.getAllByText("Trong kho").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Lịch sử" }));
    expect(await screen.findByRole("dialog", { name: "Lịch sử IMEI / Serial" })).toBeTruthy();
    expect(screen.getByText("Nhập kho")).toBeTruthy();
    expect(screen.getByText("Chưa có trạng thái → Trong kho · Admin")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Đóng lịch sử" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Lịch sử" }));
    await screen.findByRole("dialog");
    fireEvent.click(container.querySelector('[data-testid="serial-history-backdrop"]')!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
