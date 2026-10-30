// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("../../../services/retailWarrantyService", () => ({
  retailWarrantyService: { lookup: vi.fn() },
}));
vi.mock("../../../pages/Toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import WarrantyLookupPage from "./WarrantyLookupPage";
import { retailWarrantyService } from "../../../services/retailWarrantyService";
import { toast } from "../../../pages/Toast";

afterEach(() => { cleanup(); vi.clearAllMocks(); sessionStorage.clear(); });

test("renders the Retail warranty interface and automatically searches after typing", async () => {
  vi.mocked(retailWarrantyService.lookup).mockResolvedValue({ found: false });
  const user = userEvent.setup();
  render(<WarrantyLookupPage />);
  expect(screen.getByRole("heading", { name: "Tra cứu bảo hành thiết bị" })).toBeTruthy();
  expect(screen.getByText("1. Xác thực nguồn gốc từ shop")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Kiểm tra bảo hành" })).toHaveProperty("disabled", true);
  await user.type(screen.getByRole("textbox"), "AUTO-001");
  await waitFor(() => expect(retailWarrantyService.lookup).toHaveBeenCalledWith("AUTO-001"), { timeout: 2500 });
  expect(await screen.findByText("Không tìm thấy máy trong lịch sử xuất bán của shop")).toBeTruthy();
});

test("external products retain their searched serial and external intake source", async () => {
  vi.mocked(retailWarrantyService.lookup).mockResolvedValue({ found: false });
  const onCreateRepair = vi.fn();
  const user = userEvent.setup();
  render(<WarrantyLookupPage onCreateRepair={onCreateRepair} />);
  await user.type(screen.getByRole("textbox"), "EXT-001");
  await user.click(screen.getByRole("button", { name: "Kiểm tra bảo hành" }));
  await user.click(await screen.findByRole("button", { name: "Tiếp nhận sửa chữa dịch vụ (khách ngoài)" }));
  expect(onCreateRepair).toHaveBeenCalledWith(expect.objectContaining({ ticketType: "service", intakeSource: "external", serialNumber: "EXT-001", coverage: expect.objectContaining({ costBearer: "customer" }) }));
});

test("supplier coverage retains the correct days and distinct warranty and paid intake", async () => {
  vi.mocked(retailWarrantyService.lookup).mockResolvedValue({ found: true, status: "sold", serialNumber: "ERP-001", product: { productId: "p1", sku: "PRINTER", name: "Máy in" }, customerWarranty: { covered: false, daysLeft: 0 }, supplierWarranty: { covered: true, daysLeft: 60 }, costBearer: "supplier" });
  const onCreateRepair = vi.fn();
  const user = userEvent.setup();
  render(<WarrantyLookupPage onCreateRepair={onCreateRepair} />);
  await user.type(screen.getByRole("textbox"), "ERP-001");
  await user.click(screen.getByRole("button", { name: "Kiểm tra bảo hành" }));
  await user.click(await screen.findByRole("button", { name: "Tiếp nhận bảo hành miễn phí (Còn hạn)" }));
  expect(screen.getAllByText("Còn 60 ngày")).toHaveLength(2);
  expect(onCreateRepair).toHaveBeenLastCalledWith(expect.objectContaining({ ticketType: "warranty", intakeSource: "company_sale", coverage: expect.objectContaining({ costBearer: "supplier" }) }));
  await user.click(screen.getByRole("button", { name: "Tiếp nhận sửa chữa dịch vụ (kèm ưu đãi)" }));
  expect(onCreateRepair).toHaveBeenLastCalledWith(expect.objectContaining({ ticketType: "service", coverage: expect.objectContaining({ customer: { covered: false }, supplier: { covered: false }, costBearer: "customer" }) }));
});

test("editing a code prevents a late response from showing old product information", async () => {
  let resolve!: (value: { found: false }) => void;
  vi.mocked(retailWarrantyService.lookup).mockImplementation(() => new Promise(done => { resolve = done; }));
  const user = userEvent.setup();
  render(<WarrantyLookupPage />);
  await user.type(screen.getByRole("textbox"), "OLD-001");
  await user.click(screen.getByRole("button", { name: "Kiểm tra bảo hành" }));
  await user.clear(screen.getByRole("textbox"));
  await act(async () => resolve({ found: false }));
  expect(screen.queryByText("Không tìm thấy máy trong lịch sử xuất bán của shop")).toBeNull();
  expect(screen.getByText("Sẵn sàng kiểm tra thông tin bảo hành")).toBeTruthy();
});

test("a failed lookup can be retried with the Retail lookup button", async () => {
  vi.mocked(retailWarrantyService.lookup).mockRejectedValueOnce(new Error("Không kết nối được")).mockResolvedValue({ found: false });
  const user = userEvent.setup();
  render(<WarrantyLookupPage />);
  await user.type(screen.getByRole("textbox"), "ERP-002");
  await user.click(screen.getByRole("button", { name: "Kiểm tra bảo hành" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Không kết nối được"));
  await user.click(screen.getByRole("button", { name: "Kiểm tra bảo hành" }));
  expect(await screen.findByText("Không tìm thấy máy trong lịch sử xuất bán của shop")).toBeTruthy();
});

test("keeps ERP customer IDs when passing the Retail warranty result into repair intake", async () => {
  const customerId = "507f1f77bcf86cd799439011";
  vi.mocked(retailWarrantyService.lookup).mockResolvedValue({
    found: true, status: "sold", serialNumber: "IMEI123", product: { productId: "product-1", sku: "PHONE", name: "Điện thoại" },
    sold: { at: "2026-01-01", customerId, customerName: "Khách hàng", customerPhone: "0900000000" },
    customerWarranty: { covered: true, daysLeft: 100 }, supplierWarranty: { covered: false }, costBearer: "shop",
  });
  const onCreateRepair = vi.fn();
  const user = userEvent.setup();
  render(<WarrantyLookupPage onCreateRepair={onCreateRepair} />);
  await user.type(screen.getByRole("textbox", { name: "IMEI, Serial hoặc mã vạch" }), "IMEI123");
  await user.click(screen.getByRole("button", { name: "Kiểm tra bảo hành" }));
  await user.click(await screen.findByRole("button", { name: "Tiếp nhận bảo hành miễn phí (Còn hạn)" }));
  expect(onCreateRepair).toHaveBeenCalledWith(expect.objectContaining({ serialNumber: "IMEI123", customerId, coverage: expect.objectContaining({ costBearer: "shop" }) }));
});

test("does not offer repair intake for an unsold device", async () => {
  vi.mocked(retailWarrantyService.lookup).mockResolvedValue({ found: true, status: "in_stock", serialNumber: "IMEI456", product: { productId: "product-2", sku: "PHONE", name: "Điện thoại" } });
  const user = userEvent.setup();
  render(<WarrantyLookupPage onCreateRepair={vi.fn()} />);
  await user.type(screen.getByRole("textbox"), "IMEI456");
  await user.click(screen.getByRole("button", { name: "Kiểm tra bảo hành" }));
  expect(await screen.findByText("Điện thoại")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Tiếp nhận/ })).toBeNull();
});
