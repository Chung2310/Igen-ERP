// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ReceivingSection } from "./ReceivingSection";
import { listSupplierPartners } from "../../modules/partners/partnerApi";
import { inventoryReceivingService } from "../../services/inventoryReceivingService";

vi.mock("../../modules/partners/partnerApi", () => ({ listSupplierPartners: vi.fn().mockResolvedValue([
  { _id: "partner-1", code: "DT-1", name: "Nhà cung cấp đối tác", supplierId: "supplier-1" },
]) }));
vi.mock("../../services/inventoryReceivingService", () => ({ inventoryReceivingService: {
  listReceipts: vi.fn().mockResolvedValue({ items: [] }), listSuppliers: vi.fn(),
} }));
vi.mock("../../services/productCatalogService", () => ({ productCatalogService: {
  listProducts: vi.fn().mockResolvedValue({ items: [], total: 0 }),
} }));
vi.mock("../../pages/Toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
afterEach(cleanup);

it("loads receipt suppliers from partners and selects the inventory link instead of the partner ID", async () => {
  render(<ReceivingSection />);
  await userEvent.click(screen.getByRole("button", { name: "Tạo phiếu nhập mới" }));
  const option = await screen.findByRole("option", { name: "Nhà cung cấp đối tác (DT-1)" });
  expect((option as HTMLOptionElement).value).toBe("supplier-1");
  await waitFor(() => expect((screen.getByRole("combobox", { name: "Nhà cung cấp" }) as HTMLSelectElement).value).toBe("supplier-1"));
  expect(listSupplierPartners).toHaveBeenCalledOnce();
  expect(inventoryReceivingService.listSuppliers).not.toHaveBeenCalled();
});
