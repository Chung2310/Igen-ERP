// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProductEditorModal } from "./ProductEditorModal";
import { productCatalogService } from "../../../services/productCatalogService";
import { toast } from "../../../pages/Toast";

vi.mock("../../../services/productCatalogService", () => ({ productCatalogService: {
  listResources: vi.fn(), listPrices: vi.fn(), createResource: vi.fn(),
} }));
vi.mock("../../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(productCatalogService.listResources).mockResolvedValue([]);
  vi.mocked(productCatalogService.listPrices).mockResolvedValue([]);
});
afterEach(cleanup);

async function openQuickCreate() {
  render(<ProductEditorModal product={null} resources={{ categories: [], brands: [], attributes: [] }} onClose={vi.fn()} onSaved={vi.fn()} onDataChanged={vi.fn()} onVariantAction={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: /Không chọn thương hiệu/ }));
  await userEvent.click(screen.getByRole("button", { name: "Tạo nhanh nhà cung cấp / hãng" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Tên nhà cung cấp / Hãng" }), "Nguồn hàng An");
}

it("requests a linked supplier partner and selects the newly created brand", async () => {
  vi.mocked(productCatalogService.createResource).mockResolvedValue({ _id: "brand-1", code: "NCC-AN", name: "Nguồn hàng An", status: "active" });
  await openQuickCreate();
  await userEvent.click(screen.getByRole("button", { name: "Tạo ngay" }));
  await waitFor(() => expect(productCatalogService.createResource).toHaveBeenCalledWith("brands", { name: "Nguồn hàng An", code: undefined, status: "active", createSupplierPartner: true }));
  expect(await screen.findByRole("button", { name: /Nguồn hàng An/ })).toBeTruthy();
  expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Quản lý đối tác"));
});

it("keeps quick creation open and reports a failed save instead of claiming success", async () => {
  vi.mocked(productCatalogService.createResource).mockRejectedValue(new Error("Không thể tạo đối tác"));
  await openQuickCreate();
  await userEvent.click(screen.getByRole("button", { name: "Tạo ngay" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(screen.getByRole("textbox", { name: "Tên nhà cung cấp / Hãng" })).toBeTruthy();
  expect(toast.success).not.toHaveBeenCalled();
});
