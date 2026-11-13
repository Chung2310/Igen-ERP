// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProductEditorModal } from "./ProductEditorModal";
import { productCatalogService } from "../../../services/productCatalogService";
import { toast } from "../../../pages/Toast";

vi.mock("../../../services/productCatalogService", () => ({ productCatalogService: {
  listResources: vi.fn(), listPrices: vi.fn(), createResource: vi.fn(), createProduct: vi.fn(),
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
  await userEvent.click(screen.getByText("Mô tả và thông tin bổ sung"));
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

it("creates a service with a free price and a selected facility without a stock field", async () => {
  const branch = { _id: "012345678901234567890123", code: "MAIN", name: "Cơ sở A", companyCode: "ACME", isActive: true };
  vi.mocked(productCatalogService.listResources).mockImplementation(async kind => kind === "units"
    ? [{ _id: "unit", code: "UOM-BUOI", name: "Buổi", status: "active" }] : []);
  render(<ProductEditorModal product={null}
    resources={{ categories: [{ _id: "group", code: "TU-VAN", name: "Tư vấn", status: "active" }], brands: [], attributes: [] }}
    initialType="service" allowTypeSelection={false} branches={[branch]} branchId={branch._id} branchName={branch.name}
    onClose={vi.fn()} onSaved={vi.fn()} onDataChanged={vi.fn()} onVariantAction={vi.fn()} />);

  expect(screen.queryByLabelText("Theo dõi kho")).toBeNull();
  await userEvent.type(screen.getByRole("textbox", { name: /Tên dịch vụ/ }), "Tư vấn ban đầu");
  await userEvent.click(screen.getByRole("button", { name: "Nhóm dịch vụ" }));
  await userEvent.click(screen.getByRole("option", { name: /Tư vấn/ }));
  await userEvent.click(screen.getByRole("button", { name: "Đơn vị tính cơ bản" }));
  await userEvent.click(screen.getByRole("option", { name: /Buổi/ }));
  await userEvent.click(screen.getByRole("radio", { name: "Chọn cơ sở" }));
  await userEvent.click(screen.getByRole("button", { name: "Trạng thái" }));
  await userEvent.click(screen.getByRole("option", { name: "Đang kinh doanh" }));
  await userEvent.type(screen.getByRole("spinbutton", { name: /Giá bán tại Cơ sở A/ }), "0");
  await userEvent.click(screen.getByRole("button", { name: "Thêm dịch vụ" }));

  await waitFor(() => expect(productCatalogService.createProduct).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Tư vấn ban đầu", productType: "service", baseUnitCode: "UOM-BUOI",
      serviceBranchIds: [branch._id], variant: expect.objectContaining({ trackingMode: "none" }) }),
    { branchId: branch._id, sellingPrice: 0 },
  ));
});
