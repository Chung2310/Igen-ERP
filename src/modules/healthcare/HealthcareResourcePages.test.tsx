// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { HealthcareApi } from "./api";
import HealthcareEquipmentPage from "./HealthcareEquipmentPage";
import HealthcareMaterialsPage from "./HealthcareMaterialsPage";
import { healthcareHref, readHealthcareLocation } from "./navigation";

afterEach(() => cleanup());

it("routes healthcare material and equipment tabs through the shared subtab URLs", () => {
  expect(readHealthcareLocation("?sub=vat-tu", "branch-a", () => true)).toEqual({ tab: "materials" });
  expect(readHealthcareLocation("?sub=thiet-bi", "branch-a", () => true)).toEqual({ tab: "equipment" });
  expect(healthcareHref({ tab: "equipment" }, "branch-a")).toContain("sub=thiet-bi");
});

it("records a material receipt and refreshes the branch inventory list", async () => {
  const material = {
    _id: "material-1", revision: 1, createdAt: "2026-11-19T00:00:00.000Z", updatedAt: "2026-11-19T00:00:00.000Z",
    code: "GLV-01", name: "Găng tay khám", category: "Vật tư tiêu hao", unit: "hộp", lotCode: "LOT-01",
    expiryDate: "2027-11-19", quantity: 4, minimumQuantity: 2, unitCost: 12000, supplier: "Nhà cung cấp A", notes: "", status: "active" as const,
  };
  const json = vi.fn(async (path: string, options?: RequestInit) => {
    if (path.startsWith("/materials?") && !options?.method) return {
      items: [material], total: 1, page: 1, pageSize: 25, summary: { activeCount: 1, lowStockCount: 0 },
    };
    if (path === "/materials/material-1/movements" && options?.method === "POST") return { material, movement: {} };
    throw new Error(`Unexpected request: ${path}`);
  });
  const api = { json, blob: vi.fn() } as unknown as HealthcareApi;
  render(<HealthcareMaterialsPage api={api} canManage />);

  expect(await screen.findByText("Găng tay khám")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Nhập kho Găng tay khám" }));
  fireEvent.change(await screen.findByLabelText("Số lượng *"), { target: { value: "6" } });
  fireEvent.click(screen.getByRole("button", { name: "Ghi phiếu nhập" }));

  await waitFor(() => expect(json).toHaveBeenCalledWith("/materials/material-1/movements", expect.objectContaining({ method: "POST" })));
  expect(await screen.findByText("Đã ghi nhận phiếu nhập vật tư.")).toBeTruthy();
});

it("submits an equipment borrow request from the healthcare equipment list", async () => {
  const equipment = {
    _id: "equipment-1", revision: 1, createdAt: "2026-11-19T00:00:00.000Z", updatedAt: "2026-11-19T00:00:00.000Z",
    code: "MON-01", name: "Monitor theo dõi", category: "Theo dõi", status: "available" as const,
    location: "Phòng khám 1", purchaseDate: "2026-01-01", notes: "",
  };
  const json = vi.fn(async (path: string, options?: RequestInit) => {
    if (path.startsWith("/equipment?") && !options?.method) return {
      items: [equipment], total: 1, page: 1, pageSize: 25, summary: { available: 1 },
    };
    if (path === "/equipment/equipment-1/borrow-requests" && options?.method === "POST") return {};
    throw new Error(`Unexpected request: ${path}`);
  });
  const api = { json, blob: vi.fn() } as unknown as HealthcareApi;
  render(<HealthcareEquipmentPage api={api} canManage={false} userId="staff-1" />);

  expect(await screen.findByText("Monitor theo dõi")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Mượn" }));
  fireEvent.change(await screen.findByLabelText("Mục đích sử dụng *"), { target: { value: "Theo dõi bệnh nhân" } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));

  await waitFor(() => expect(json).toHaveBeenCalledWith("/equipment/equipment-1/borrow-requests", expect.objectContaining({ method: "POST" })));
  expect(await screen.findByText("Đã gửi yêu cầu mượn thiết bị.")).toBeTruthy();
});
