// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("../../../services/retailWarrantyService", () => ({
  retailWarrantyService: { lookup: vi.fn(), expiring: vi.fn(), gapRisk: vi.fn() },
}));
vi.mock("../../../pages/Toast", () => ({ toast: { error: vi.fn() } }));

import WarrantyLookupPage from "./WarrantyLookupPage";
import { retailWarrantyService } from "../../../services/retailWarrantyService";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("external products retain their searched serial and external intake source", async () => {
  vi.mocked(retailWarrantyService.lookup).mockResolvedValue({ found: false });
  const onCreateRepair = vi.fn();
  const user = userEvent.setup();
  render(<WarrantyLookupPage onCreateRepair={onCreateRepair} canManage={false} />);
  await user.type(screen.getByRole("textbox"), "EXT-001");
  await user.click(screen.getByRole("button", { name: "Tra cứu" }));
  await user.click(await screen.findByRole("button", { name: "Tiếp nhận sửa chữa dịch vụ (khách ngoài)" }));
  expect(onCreateRepair).toHaveBeenCalledWith(expect.objectContaining({ ticketType: "service", intakeSource: "external", serialNumber: "EXT-001", coverage: expect.objectContaining({ costBearer: "customer" }) }));
});

test("supplier coverage shows its remaining days and supports distinct warranty and paid intake", async () => {
  vi.mocked(retailWarrantyService.lookup).mockResolvedValue({ found: true, status: "sold", serialNumber: "ERP-001", product: { productId: "p1", sku: "PRINTER", name: "Máy in" }, customerWarranty: { covered: false, daysLeft: 0 }, supplierWarranty: { covered: true, daysLeft: 60 }, costBearer: "supplier" });
  const onCreateRepair = vi.fn();
  const user = userEvent.setup();
  render(<WarrantyLookupPage onCreateRepair={onCreateRepair} canManage={false} />);
  await user.type(screen.getByRole("textbox"), "ERP-001");
  await user.click(screen.getByRole("button", { name: "Tra cứu" }));
  await user.click(await screen.findByRole("button", { name: "Tạo phiếu sửa chữa/bảo hành" }));
  expect(screen.getAllByText("Còn 60 ngày")).toHaveLength(2);
  expect(onCreateRepair).toHaveBeenLastCalledWith(expect.objectContaining({ ticketType: "warranty", intakeSource: "company_sale", coverage: expect.objectContaining({ costBearer: "supplier" }) }));
  await user.click(screen.getByRole("button", { name: "Tạo phiếu sửa chữa dịch vụ" }));
  expect(onCreateRepair).toHaveBeenLastCalledWith(expect.objectContaining({ ticketType: "service", coverage: expect.objectContaining({ customer: { covered: false }, supplier: { covered: false }, costBearer: "customer" }) }));
});

test("editing a code prevents a late response from showing old product information", async () => {
  let resolve!: (value: { found: false }) => void;
  vi.mocked(retailWarrantyService.lookup).mockImplementation(() => new Promise(done => { resolve = done; }));
  const user = userEvent.setup();
  render(<WarrantyLookupPage canManage={false} />);
  await user.type(screen.getByRole("textbox"), "OLD-001");
  await user.click(screen.getByRole("button", { name: "Tra cứu" }));
  await user.clear(screen.getByRole("textbox"));
  await act(async () => resolve({ found: false }));
  expect(screen.queryByText("Không tìm thấy sản phẩm trong hệ thống")).toBeNull();
  expect(screen.getByText("Sẵn sàng kiểm tra thông tin bảo hành")).toBeTruthy();
});

test("a failed lookup can be retried inline", async () => {
  vi.mocked(retailWarrantyService.lookup).mockRejectedValueOnce(new Error("Không kết nối được")).mockResolvedValue({ found: false });
  const user = userEvent.setup();
  render(<WarrantyLookupPage canManage={false} />);
  await user.type(screen.getByRole("textbox"), "ERP-002");
  await user.click(screen.getByRole("button", { name: "Tra cứu" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Không kết nối được"));
  await user.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(await screen.findByText("Không tìm thấy sản phẩm trong hệ thống")).toBeTruthy();
});

test("creates a repair prefill from a sold phone's warranty result", async () => {
  vi.mocked(retailWarrantyService.lookup).mockResolvedValue({
    found: true, status: "sold", serialNumber: "IMEI123", product: { productId: "product-1", sku: "PHONE", name: "Điện thoại" },
    sold: { at: "2026-01-01", customerId: "customer-1", customerName: "Khách hàng", customerPhone: "0900000000" },
    customerWarranty: { covered: true, daysLeft: 100 }, supplierWarranty: { covered: false }, costBearer: "shop",
  });
  const onCreateRepair = vi.fn();
  const user = userEvent.setup();
  render(<WarrantyLookupPage onCreateRepair={onCreateRepair} canManage={false} />);
  await user.type(screen.getByRole("textbox", { name: "Serial hoặc mã định danh sản phẩm" }), "IMEI123");
  await user.click(screen.getByRole("button", { name: "Tra cứu" }));
  await user.click(await screen.findByRole("button", { name: "Tạo phiếu sửa chữa/bảo hành" }));
  expect(onCreateRepair).toHaveBeenCalledWith(expect.objectContaining({ serialNumber: "IMEI123", customerId: "customer-1", coverage: expect.objectContaining({ costBearer: "shop" }) }));
  expect(screen.queryByText("Danh sách sắp hết hạn")).toBeNull();
});

test("does not offer a repair ticket for an unsold device", async () => {
  vi.mocked(retailWarrantyService.lookup).mockResolvedValue({ found: true, status: "in_stock", serialNumber: "IMEI456", product: { productId: "product-2", sku: "PHONE", name: "Điện thoại" } });
  const user = userEvent.setup();
  render(<WarrantyLookupPage onCreateRepair={vi.fn()} canManage={false} />);
  await user.type(screen.getByRole("textbox", { name: "Serial hoặc mã định danh sản phẩm" }), "IMEI456");
  await user.click(screen.getByRole("button", { name: "Tra cứu" }));
  expect(await screen.findByText("Điện thoại")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Tạo phiếu sửa chữa/bảo hành" })).toBeNull();
});
