// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  it("opens history in a dialog and closes from the close control or backdrop", async () => {
    const { container } = render(<SerialRegistrySection />);
    await screen.findByText("IMEI-001");

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
