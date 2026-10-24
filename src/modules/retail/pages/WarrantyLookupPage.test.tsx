// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("../../../services/retailWarrantyService", () => ({
  retailWarrantyService: { lookup: vi.fn(), expiring: vi.fn(), gapRisk: vi.fn() },
}));
vi.mock("../../../pages/Toast", () => ({ toast: { error: vi.fn() } }));

import WarrantyLookupPage from "./WarrantyLookupPage";
import { retailWarrantyService } from "../../../services/retailWarrantyService";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("creates a repair prefill from a sold phone's warranty result", async () => {
  vi.mocked(retailWarrantyService.lookup).mockResolvedValue({
    found: true, status: "sold", serialNumber: "IMEI123", product: { productId: "product-1", sku: "PHONE", name: "Điện thoại" },
    sold: { at: "2026-01-01", customerId: "customer-1", customerName: "Khách hàng", customerPhone: "0900000000" },
    customerWarranty: { covered: true, daysLeft: 100 }, supplierWarranty: { covered: false }, costBearer: "shop",
  });
  const onCreateRepair = vi.fn();
  const user = userEvent.setup();
  render(<WarrantyLookupPage onCreateRepair={onCreateRepair} canManage={false} />);
  await user.type(screen.getByRole("textbox", { name: "IMEI, Serial hoặc mã vạch nội bộ" }), "IMEI123");
  await user.click(screen.getByRole("button", { name: "Tra cứu" }));
  await user.click(await screen.findByRole("button", { name: "Tạo phiếu sửa chữa/bảo hành" }));
  expect(onCreateRepair).toHaveBeenCalledWith(expect.objectContaining({ serialNumber: "IMEI123", customerId: "customer-1", coverage: expect.objectContaining({ costBearer: "shop" }) }));
  expect(screen.queryByText("Danh sách sắp hết hạn")).toBeNull();
});

test("does not offer a repair ticket for an unsold device", async () => {
  vi.mocked(retailWarrantyService.lookup).mockResolvedValue({ found: true, status: "in_stock", serialNumber: "IMEI456", product: { productId: "product-2", sku: "PHONE", name: "Điện thoại" } });
  const user = userEvent.setup();
  render(<WarrantyLookupPage onCreateRepair={vi.fn()} canManage={false} />);
  await user.type(screen.getByRole("textbox", { name: "IMEI, Serial hoặc mã vạch nội bộ" }), "IMEI456");
  await user.click(screen.getByRole("button", { name: "Tra cứu" }));
  expect(await screen.findByText("Điện thoại")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Tạo phiếu sửa chữa/bảo hành" })).toBeNull();
});
