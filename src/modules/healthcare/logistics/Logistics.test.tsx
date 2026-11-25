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
import SupplyProfiles from "./SupplyProfiles";
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
  expect((await screen.findAllByText(/Chưa có thiết bị phù hợp/)).length).toBeGreaterThan(0);
  expect(screen.queryByRole("heading", { name: "Quản lý thiết bị" })).toBeNull();
  expect(calls.some((x) => /patients|appointments|visits/.test(x.path))).toBe(
    false,
  );
  const navigation = screen.getByRole("navigation", { name: "Nghiệp vụ y tế" });
  fireEvent.click(within(navigation).getByRole("button", { name: "Vật tư" }));
  expect(
    await screen.findByRole("navigation", { name: "Điều hướng quản lý vật tư" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Quản lý Vật tư & Thiết bị tiêu hao" }),
  ).toBeNull();
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
it("submits borrow and return requests in one modal with a searchable equipment dropdown", async () => {
  const calls = stub([row]);
  render(<LogisticsPage kind="equipment" branchId="branch" hasPermission={() => true} />);
  expect((await screen.findAllByText("Máy siêu âm")).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu mượn/trả" }));
  const dialog = await screen.findByRole("dialog", { name: "Tạo phiếu mượn/trả thiết bị" });
  expect(within(dialog).queryByRole("listbox")).toBeNull();
  const combobox = within(dialog).getByRole("combobox");
  fireEvent.click(combobox);
  const listbox = await within(dialog).findByRole("listbox", { name: "Danh sách thiết bị" });
  fireEvent.click(await within(listbox).findByRole("option", { name: /Máy siêu âm/ }));
  expect(within(dialog).queryByRole("listbox")).toBeNull();
  fireEvent.change(within(dialog).getByLabelText(/Lý do/), { target: { value: "Khám buổi sáng" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Gửi yêu cầu mượn" }));
  await waitFor(() =>
    expect(calls.some((call) => call.method === "POST" && call.path === "/logistics/equipment/e1/requests")).toBe(true),
  );
  expect(calls.find((call) => call.path === "/logistics/equipment/e1/requests")?.body).toMatchObject({
    type: "borrow",
    reason: "Khám buổi sáng",
  });
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
it("quick-adds category, supplier, and warehouse directly from SupplyEditor dropdowns", async () => {
  const calls: { path: string; method?: string; body?: unknown }[] = [];
  const onRefsChanged = vi.fn();
  const api = {
    json: vi.fn(async (path: string, options?: RequestInit) => {
      const body = options?.body ? JSON.parse(String(options.body)) : undefined;
      calls.push({ path, method: options?.method, body });
      if (path === "/logistics/directories/categories") return { _id: "cat-1", code: "PL-01", name: "Vật tư tiêu hao", revision: 1, active: true, editable: true };
      if (path === "/logistics/directories/suppliers") return { _id: "sup-1", code: "NCC-01", name: "Công ty Y tế Mới", revision: 1, active: true, editable: true };
      if (path === "/logistics/directories/warehouses") return { _id: "wh-1", code: "KHO-01", name: "Kho Trung Tâm Mới", revision: 1, active: true, editable: true };
      return { _id: "supply-1" };
    }),
  } as unknown as HealthcareApi;

  render(<SupplyEditor api={api} refs={refs} onRefsChanged={onRefsChanged} onClose={() => {}} onSaved={() => {}} />);

  for (const [fieldLabel, actionText, regionName, code, name] of [
    ["Danh mục phân loại", "Thêm phân loại", "Thêm phân loại mới", "pl-01", "Vật tư tiêu hao"],
    ["Nhà cung cấp / Hãng sản xuất", "Thêm nhà cung cấp", "Thêm nhà cung cấp mới", "ncc-01", "Công ty Y tế Mới"],
    ["Vị trí kho lưu trữ", "Thêm kho lưu trữ", "Thêm kho lưu trữ mới", "kho-01", "Kho Trung Tâm Mới"],
  ] as const) {
    fireEvent.click(screen.getByRole("button", { name: fieldLabel }));
    fireEvent.click(screen.getByRole("button", { name: actionText }));
    const panel = screen.getByRole("region", { name: regionName });
    fireEvent.change(within(panel).getByLabelText(/Mã/), { target: { value: code } });
    fireEvent.change(within(panel).getByLabelText(/Tên/), { target: { value: name } });
    fireEvent.click(within(panel).getByRole("button", { name: "Thêm" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: regionName })).toBeNull());
  }

  expect(onRefsChanged).toHaveBeenCalledTimes(3);
  expect(calls.map((c) => c.path)).toEqual([
    "/logistics/directories/categories",
    "/logistics/directories/suppliers",
    "/logistics/directories/warehouses",
  ]);
  expect(calls[0].body).toMatchObject({ code: "PL-01", name: "Vật tư tiêu hao", active: true });
  expect(calls[1].body).toMatchObject({ code: "NCC-01", name: "Công ty Y tế Mới", active: true });
  expect(calls[2].body).toMatchObject({ code: "KHO-01", name: "Kho Trung Tâm Mới", active: true });
  expect(screen.getByRole("button", { name: "Danh mục phân loại" }).textContent).toContain("Vật tư tiêu hao");
  expect(screen.getByRole("button", { name: "Nhà cung cấp / Hãng sản xuất" }).textContent).toContain("Công ty Y tế Mới");
  expect(screen.getByRole("button", { name: "Vị trí kho lưu trữ" }).textContent).toContain("Kho Trung Tâm Mới");
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
it("validates equipment selection and hides expected return date when switching to return mode", async () => {
  stub([row]);
  render(<LogisticsPage kind="equipment" branchId="branch" hasPermission={() => true} />);
  await screen.findAllByText("Máy siêu âm");
  fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu mượn/trả" }));
  const dialog = await screen.findByRole("dialog", { name: "Tạo phiếu mượn/trả thiết bị" });
  expect(within(dialog).getByLabelText("Ngày dự kiến trả")).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Trả thiết bị" }));
  expect(within(dialog).queryByLabelText("Ngày dự kiến trả")).toBeNull();
  fireEvent.change(within(dialog).getByLabelText(/Lý do/), { target: { value: "Trả sau ca khám" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Gửi yêu cầu trả" }));
  expect(await within(dialog).findByText("Vui lòng chọn thiết bị.")).toBeTruthy();
});
it("adds, previews, removes, and saves supply unit conversions from SupplyProfiles", async () => {
  const supply = {
    _id: "s1",
    code: "VT01",
    name: "Bông gòn y tế",
    unit: "Gói",
    precision: 0,
    trackingMode: "lot",
    requiresExpiry: true,
    conversions: [],
    revision: 1,
    active: true,
    minQuantity: 0,
    category: "",
    supplierId: "",
    warehouseId: "",
    notes: "",
    documents: [],
    createdAt: "",
    updatedAt: "",
  };
  const json = vi.fn(async (path: string, options?: RequestInit) =>
    options?.method === "PUT"
      ? { ...supply, revision: 2 }
      : { items: [supply], total: 1, page: 1, pageSize: 25 },
  );
  render(<SupplyProfiles api={{ json } as unknown as HealthcareApi} canManage />);
  fireEvent.click(await screen.findByRole("button", { name: "Cấu hình" }));
  const dialog = await screen.findByRole("dialog", { name: "Quy đổi · Bông gòn y tế" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Thêm đơn vị quy đổi" }));
  fireEvent.change(within(dialog).getByLabelText(/Đơn vị quy đổi 1/), { target: { value: "Thùng" } });
  fireEvent.change(within(dialog).getByLabelText(/Số Gói trong 1 đơn vị/), { target: { value: "20" } });
  expect(dialog.textContent).toMatch(/1\s*Thùng\s*=\s*20\s*Gói/);
  fireEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(json).toHaveBeenCalledWith(
      "/logistics/profiles/s1",
      expect.objectContaining({ method: "PUT" }),
    ),
  );
  const putCall = json.mock.calls.find(([path, opts]) => path === "/logistics/profiles/s1" && opts?.method === "PUT");
  expect(JSON.parse(String(putCall?.[1]?.body))).toMatchObject({
    revision: 1,
    conversions: [{ unit: "Thùng", factor: "20" }],
  });
});
