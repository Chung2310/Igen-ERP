// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HealthcareWorkspace } from "../HealthcarePage";
import LogisticsPage from "./LogisticsPage";
import SupplyDocumentEditor from "./SupplyDocumentEditor";
import SupplyEditor from "./SupplyEditor";
import type { HealthcareApi } from "../api";

vi.mock("../../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../../context/BranchContext", () => ({ useBranch: vi.fn() }));
beforeEach(() => {
  window.history.replaceState(null, "", "/quan-ly-y-te?sub=thiet-bi");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const refs = { warehouses: [], suppliers: [], departments: [], rooms: [] };
const row = {
  _id: "e1",
  revision: 1,
  code: "TB01",
  name: "Máy siêu âm",
  category: "Chẩn đoán",
  status: "available",
  nextInspectionDay: "",
  documents: [],
};
function stub(items: unknown[] = []) {
  const calls: { path: string; method?: string; body?: unknown }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const path = url.replace("/api/v1/healthcare", "").split("?")[0];
    calls.push({
      path,
      method: init?.method,
      body: init?.body instanceof FormData ? init.body : init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (path === "/logistics/overview/supplies")
      return Response.json({
        totalItems: 0,
        totalQuantity: 0,
        totalValue: 0,
        lowStock: 0,
        expired: 0,
        expiringSoon: 0,
      });
    if (path.endsWith("-references")) return Response.json(refs);
    if (init?.method === "POST" && path === "/logistics/equipment")
      return Response.json(row);
    return Response.json({ items, total: items.length, page: 1, pageSize: 25 });
  });
  return calls;
}
it("opens equipment via healthcare navigation without loading patient data", async () => {
  const calls = stub();
  render(
    <HealthcareWorkspace
      branchId="branch"
      hasPermission={(code) =>
        ["healthcare:read", "healthcare:manage"].includes(code)
      }
    />,
  );
  expect(
    await screen.findByRole("heading", { name: "Quản lý thiết bị" }),
  ).toBeTruthy();
  expect((await screen.findAllByText(/Chưa có thiết bị phù hợp/)).length).toBeGreaterThan(0);
  expect(calls.some((x) => /patients|appointments|visits/.test(x.path))).toBe(
    false,
  );
  const navigation = screen.getByRole("navigation", { name: "Nghiệp vụ y tế" });
  fireEvent.click(within(navigation).getByRole("button", { name: "Vật tư" }));
  expect(
    await screen.findByRole("heading", {
      name: "Quản lý Vật tư & Thiết bị tiêu hao",
    }),
  ).toBeTruthy();
  for (const label of [
    "Vật tư",
    "Nhập / Xuất kho",
    "Nhà cung cấp",
    "Kho lưu trữ",
    "Phân loại",
    "Tồn theo lô",
    "Đơn vị quy đổi",
  ])
    expect(
      within(
        screen.getByRole("navigation", { name: "Điều hướng quản lý vật tư" }),
      ).getByRole("button", {
        name: label,
      }),
    ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "+ Khai báo danh mục mới" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "+ Nhập kho theo lô" }),
  ).toBeTruthy();
  expect(window.location.search).toContain("vat-tu");
});
it("keeps creation and editing hidden for a reader", async () => {
  stub([row]);
  render(
    <LogisticsPage
      kind="equipment"
      branchId="branch"
      hasPermission={(p) => p.endsWith(":read")}
    />,
  );
  expect((await screen.findAllByText("Máy siêu âm")).length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: "Thêm thiết bị" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Sửa" })).toBeNull();
  expect(screen.getAllByRole("button", { name: "Yêu cầu mượn" }).length).toBeGreaterThan(0);
});
it("submits a new equipment form through the healthcare API", async () => {
  const calls = stub();
  render(
    <LogisticsPage
      kind="equipment"
      branchId="branch"
      hasPermission={() => true}
    />,
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Thêm thiết bị",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Thêm thiết bị" }));
  for (const label of [
    "Ngày kiểm định / hiệu chuẩn / bảo trì gần nhất",
    "Kết quả thực hiện",
    "Đơn vị thực hiện",
    "Biên bản kiểm định (PDF/PNG/JPEG, tối đa 3 MB/tệp)",
  ])
    expect(screen.getByText(label)).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/Mã thiết bị/), {
    target: { value: "TB01" },
  });
  fireEvent.change(screen.getByLabelText(/Tên thiết bị/), {
    target: { value: "Máy siêu âm" },
  });
  fireEvent.change(screen.getByLabelText(/Danh mục thiết bị/), {
    target: { value: "Chẩn đoán" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(
      calls.some(
        (x) => x.method === "POST" && x.path === "/logistics/equipment",
      ),
    ).toBe(true),
  );
  expect(calls.find((x) => x.method === "POST")?.body).toMatchObject({
    code: "TB01",
    name: "Máy siêu âm",
    documents: [],
  });
});
it("uploads equipment image, inspection report, and typed legal file", async () => {
  const calls = stub();
  render(<LogisticsPage kind="equipment" branchId="branch" hasPermission={() => true} />);
  await screen.findByRole("button", { name: "Thêm thiết bị" });
  fireEvent.click(screen.getByRole("button", { name: "Thêm thiết bị" }));
  fireEvent.change(screen.getByLabelText(/Mã thiết bị/), { target: { value: "TB02" } });
  fireEvent.change(screen.getByLabelText(/Tên thiết bị/), { target: { value: "Máy X quang" } });
  fireEvent.change(screen.getByLabelText(/Danh mục thiết bị/), { target: { value: "Chẩn đoán" } });
  fireEvent.change(screen.getByLabelText(/Hình ảnh thiết bị/), {
    target: { files: [new File(["image"], "photo.png", { type: "image/png" })] },
  });
  fireEvent.change(screen.getByLabelText(/Biên bản kiểm định/), {
    target: { files: [new File(["report"], "report.pdf", { type: "application/pdf" })] },
  });
  fireEvent.change(screen.getByLabelText(/Tệp hồ sơ pháp lý/), {
    target: { files: [new File(["invoice"], "invoice.pdf", { type: "application/pdf" })] },
  });
  fireEvent.change(screen.getByLabelText("Số văn bản"), { target: { value: "INV-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(calls.filter((call) => call.path.endsWith("/attachment"))).toHaveLength(3));
  const uploads = calls.filter((call) => call.path.endsWith("/attachment")).map((call) => call.body as FormData);
  expect(uploads[0].get("image")).toBe("true");
  expect(uploads[1].get("report")).toBe("true");
  expect(JSON.parse(String(uploads[2].get("metadata")))).toMatchObject({ name: "invoice.pdf", number: "INV-01" });
});
it("opens the LuxCare-style borrow and return flow from one page action", async () => {
  const calls = stub([row]);
  render(<LogisticsPage kind="equipment" branchId="branch" hasPermission={() => true} />);
  expect((await screen.findAllByText("Máy siêu âm")).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu mượn/trả" }));
  const picker = await screen.findByRole("dialog", { name: "Tạo phiếu mượn/trả thiết bị" });
  fireEvent.click(await within(picker).findByRole("button", { name: "Chọn mượn" }));
  expect(await screen.findByRole("dialog", { name: "Yêu cầu mượn thiết bị" })).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button", { name: "Đóng" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu mượn/trả" }));
  const returnPicker = await screen.findByRole("dialog", { name: "Tạo phiếu mượn/trả thiết bị" });
  fireEvent.click(within(returnPicker).getByRole("button", { name: "Trả thiết bị" }));
  expect(within(returnPicker).getByRole("button", { name: "Trả thiết bị" }).getAttribute("aria-pressed")).toBe("true");
  await waitFor(() => expect(calls.some((call) => call.path === "/logistics/equipment")).toBe(true));
});
it("saves supply lot, expiry, inspection and uploads files from its editor", async () => {
  const calls: { path: string; body: unknown }[] = [];
  const api = { json: vi.fn(async (path: string, options: RequestInit) => {
    calls.push({ path, body: options.body instanceof FormData ? options.body : JSON.parse(String(options.body)) });
    return { _id: "supply-1" };
  }) } as unknown as HealthcareApi;
  render(<SupplyEditor api={api} refs={refs} onClose={() => {}} onSaved={() => {}} />);
  fireEvent.change(screen.getByLabelText(/Mã vật tư/), { target: { value: "VT02" } });
  fireEvent.change(screen.getByLabelText(/Tên vật tư/), { target: { value: "Găng tay" } });
  fireEvent.change(screen.getByLabelText(/Đơn vị tính/), { target: { value: "Hộp" } });
  fireEvent.change(screen.getByLabelText("Số lô sản xuất (Batch/Lot)"), { target: { value: "LOT-01" } });
  fireEvent.change(screen.getByLabelText("Số phiếu / Giấy kiểm định"), { target: { value: "KD-01" } });
  fireEvent.change(screen.getByLabelText("Tải ảnh vật tư"), { target: { files: [new File(["image"], "image.png", { type: "image/png" })] } });
  fireEvent.change(screen.getByLabelText("Tải tài liệu vật tư"), { target: { files: [new File(["doc"], "doc.pdf", { type: "application/pdf" })] } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(calls).toHaveLength(3));
  expect(calls[0].body).toMatchObject({ batchNumber: "LOT-01", inspectionCertificateNumber: "KD-01", code: "VT02" });
  expect((calls[1].body as FormData).get("image")).toBe("true");
  expect(calls[2].path).toBe("/logistics/files/supplies/supply-1/attachment");
});
it("shows all source equipment table columns", async () => {
  stub([row]);
  render(
    <LogisticsPage
      kind="equipment"
      branchId="branch"
      hasPermission={() => true}
    />,
  );
  expect((await screen.findAllByText("Máy siêu âm")).length).toBeGreaterThan(0);
  for (const label of [
    "Mã & Tên thiết bị",
    "Phân loại Y tế",
    "Model & Seri",
    "Trạng thái",
    "Kiểm định & Biên bản",
    "Hồ sơ & Giấy tờ",
    "Phòng ban",
    "Vị trí",
    "Thao tác",
  ])
    expect(screen.getByRole("columnheader", { name: label })).toBeTruthy();
});
it("requires confirmation before posting and uses a retry key", async () => {
  const doc = {
    _id: "d1",
    revision: 3,
    type: "receipt",
    status: "approved",
    reason: "Nhập mới",
    warehouseId: "w",
    createdAt: "2026-11-21T00:00:00Z",
    lines: [],
  };
  const calls = stub([doc]);
  render(
    <LogisticsPage
      kind="supplies"
      branchId="branch"
      hasPermission={() => true}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Phiếu kho" }));
  fireEvent.click(await screen.findByRole("button", { name: "Ghi sổ" }));
  expect(calls.some((x) => x.method === "POST")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
  await waitFor(() =>
    expect(calls.some((x) => x.path === "/logistics/documents/d1/action")).toBe(
      true,
    ),
  );
});
it("completes a batch with its selected supply, unit and lot through the stock API", async () => {
  const item = {
    _id: "v1",
    name: "Găng tay",
    code: "VT01",
    unit: "Đôi",
    revision: 1,
    active: true,
    requiresExpiry: false,
    minQuantity: 0,
    category: "",
    supplierId: "",
    warehouseId: "w1",
    notes: "",
    documents: [],
    createdAt: "",
    updatedAt: "",
  };
  const json = vi.fn(async (path: string, options?: RequestInit) =>
    path === "/logistics/supplies/v1"
      ? item
      : options?.method
        ? { status: "posted" }
        : { items: [item], total: 1, page: 1, pageSize: 100 },
  );
  const saved = vi.fn();
  render(
    <SupplyDocumentEditor
      api={{ json } as unknown as HealthcareApi}
      refs={{ ...refs, warehouses: [{ _id: "w1", name: "Kho y tế" }] }}
      batchType="receipt"
      initialSupply={item}
      onClose={() => {}}
      onSaved={saved}
    />,
  );
  await screen.findByRole("button", { name: "Đơn vị giao dịch" });
  fireEvent.change(screen.getByLabelText(/Lý do/), {
    target: { value: "Nhập bổ sung" },
  });
  fireEvent.change(screen.getByLabelText("Số lô"), {
    target: { value: "LOT-1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Hoàn tất Nhập kho theo lô" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const call = json.mock.calls.find(
    ([path, options]) =>
      path === "/logistics/batch-stock" && options?.method === "POST",
  );
  expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
    type: "receipt",
    warehouseId: "w1",
    reason: "Nhập bổ sung",
    voucherCode: expect.stringMatching(/^PNK-/),
    voucherDay: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    lines: [{ supplyId: "v1", unit: "Đôi", lot: "LOT-1", quantity: 1 }],
  });
  expect(call?.[1]?.headers).toHaveProperty("Idempotency-Key");
});
it("saves a stock receipt as a draft from the same popup", async () => {
  const item = {
    _id: "v1", name: "Găng tay", code: "VT01", unit: "Đôi", revision: 1,
    active: true, requiresExpiry: false, minQuantity: 0, category: "",
    supplierId: "", warehouseId: "w1", notes: "", documents: [],
    createdAt: "", updatedAt: "",
  };
  const json = vi.fn(async (path: string, options?: RequestInit) =>
    path === "/logistics/supplies/v1" ? item : options?.method
      ? { status: "draft" }
      : { items: [item], total: 1, page: 1, pageSize: 100 },
  );
  const saved = vi.fn();
  render(<SupplyDocumentEditor api={{ json } as unknown as HealthcareApi}
    refs={{ ...refs, warehouses: [{ _id: "w1", name: "Kho y tế" }] }}
    batchType="receipt" initialSupply={item} onClose={() => {}} onSaved={saved} />);
  fireEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const call = json.mock.calls.find(([path, options]) => path === "/logistics/documents" && options?.method === "POST");
  expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
    type: "receipt", warehouseId: "w1", lines: [{ supplyId: "v1" }],
    voucherCode: expect.stringMatching(/^PNK-/),
  });
  expect(json.mock.calls.some(([path]) => path === "/logistics/batch-stock")).toBe(false);
});
