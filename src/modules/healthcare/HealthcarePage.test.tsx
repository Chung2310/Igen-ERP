// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { hospitalReportColumns } from "../../../shared/healthcare";
import { HealthcareWorkspace } from "./HealthcarePage";

function hospitalWorkbookFile() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["BÁO CÁO"], [], Object.values(hospitalReportColumns), [1, 1, 46_325, "QA001", "Nguyễn QA", "BN001"],
  ]), "Tháng 10");
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([bytes], "Lượt khám.xlsx");
}

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../context/BranchContext", () => ({ useBranch: vi.fn() }));

beforeEach(() => window.history.replaceState(null, "", "/quan-ly-y-te"));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("loads directories on demand and waits for catalog choices before editing an appointment", async () => {
  const patient = { _id: "p1", code: "BN01", name: "Nguyễn An" };
  const appointment = {
    _id: "a1", patientId: patient._id, doctorId: "d1", status: "scheduled",
    startsAt: "2026-11-07T02:00:00.000Z", endsAt: "2026-11-07T02:30:00.000Z",
  };
  const calls: string[] = [];
  let resolveCatalog!: (response: Response) => void;
  const pendingCatalog = new Promise<Response>(resolve => { resolveCatalog = resolve; });
  vi.stubGlobal("fetch", async (url: string) => {
    const path = url.replace("/api/v1/healthcare", "").split("?")[0];
    calls.push(path);
    if (path === "/patients/search") return Response.json({ items: [], total: 0 });
    if (path === "/appointments") return Response.json({
      items: [appointment], total: 1, patientReferences: [patient],
    });
    if (path === "/catalog") return pendingCatalog;
    if (path === "/staff") return Response.json([{ _id: "s1", name: "Nhân viên thử" }]);
    throw new Error(`Unexpected request: ${path}`);
  });
  render(<HealthcareWorkspace branchId="branch-a" hasPermission={() => true} />);

  expect(await screen.findByText("Chưa có dữ liệu phù hợp.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Tổng quan" })).toBeNull();
  expect(calls).toEqual(["/patients/search"]);
  fireEvent.click(screen.getByRole("button", { name: "Lịch hẹn" }));
  fireEvent.click(await screen.findByRole("button", { name: "Sửa lịch hẹn" }));
  const editor = within(screen.getByRole("dialog", { name: "Chỉnh sửa lịch hẹn" }));
  expect(editor.getByRole("status").textContent).toBe("Đang tải dữ liệu…");
  expect(screen.queryByRole("button", { name: "Lưu" })).toBeNull();

  await act(async () => {
    resolveCatalog(Response.json([{ _id: "d1", kind: "doctor", name: "Bác sĩ Minh", active: true }]));
  });
  const doctor = await screen.findByLabelText("Bác sĩ");
  expect((doctor as HTMLSelectElement).value).toBe("d1");
  expect(calls).toHaveLength(3);
  expect(calls).toEqual(expect.arrayContaining(["/patients/search", "/appointments", "/catalog"]));

  fireEvent.click(editor.getByRole("button", { name: "Đóng biểu mẫu" }));
  fireEvent.click(screen.getByRole("button", { name: "Giao việc chăm sóc" }));
  const assignee = await screen.findByLabelText(/Nhân viên phụ trách/);
  expect(assignee.textContent).toContain("Nhân viên thử");
  expect(calls.slice(3)).toEqual(["/staff"]);
});

it("opens the create form and confirms cancellation before writing a versioned status change", async () => {
  const appointment = {
    _id: "a1", patientId: "p1", doctorId: "d1", status: "scheduled", revision: 3,
    startsAt: "2026-11-07T02:00:00Z", endsAt: "2026-11-07T02:30:00Z", createdAt: "2026-11-01T00:00:00Z",
  };
  const update = vi.fn();
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url.includes("/patients/search")) return Response.json({ items: [], total: 0 });
    if (url.endsWith("/catalog")) return Response.json([]);
    if (init.method === "PATCH") {
      update(url, JSON.parse(String(init.body)));
      return Response.json({ ...appointment, status: "cancelled" });
    }
    return Response.json({ items: [appointment], total: 1, patientReferences: [] });
  });
  render(<HealthcareWorkspace branchId="branch-a" hasPermission={() => true} />);
  fireEvent.click(screen.getByRole("button", { name: "Thêm bệnh nhân" }));
  const create = within(screen.getByRole("dialog", { name: "Thêm bệnh nhân" }));
  expect(create.getByLabelText(/Mã bệnh nhân/)).toBeTruthy();
  fireEvent.click(create.getByRole("button", { name: "Đóng biểu mẫu" }));

  fireEvent.click(screen.getByRole("button", { name: "Lịch hẹn" }));
  const cancel = await screen.findByRole("button", { name: "Hủy lịch hẹn" });
  fireEvent.click(cancel);
  const confirmation = within(screen.getByRole("alertdialog", { name: "Hủy lịch hẹn" }));
  expect(update).not.toHaveBeenCalled();
  fireEvent.click(confirmation.getByRole("button", { name: "Quay lại" }));
  expect(update).not.toHaveBeenCalled();
  fireEvent.click(cancel);
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Xác nhận hủy" }));
  await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
  expect(update).toHaveBeenCalledWith("/api/v1/healthcare/appointments/a1", {
    patientId: "p1", doctorId: "d1", status: "cancelled", revision: 3, startsAt: appointment.startsAt, endsAt: appointment.endsAt,
  });
  expect(await screen.findByText("Đã hủy bản ghi.")).toBeTruthy();
});

it("opens patient details and the edit form as popups from the patient list", async () => {
  const patient = {
    _id: "p1", code: "BN01", name: "Nguyễn An", phone: "0900000000", dateOfBirth: "2010-11-07",
    address: "Hà Nội", note: "Ghi chú", hospitalProfile: { gender: "Nữ", birthYear: "2010", phoneText: "0900000000" },
  };
  vi.stubGlobal("fetch", async (url: string) => {
    const path = url.replace("/api/v1/healthcare", "").split("?")[0];
    if (path === "/patients/search") return Response.json({ items: [patient], total: 1 });
    if (path === "/patients/p1") return Response.json(patient);
    throw new Error(`Unexpected request: ${path}`);
  });
  render(<HealthcareWorkspace branchId="branch-a" hasPermission={() => true} />);

  fireEvent.click(await screen.findByRole("button", { name: "BN01" }));
  const details = within(await screen.findByRole("dialog", { name: "Hồ sơ bệnh nhân · BN01" }));
  expect(details.getByText("Nguyễn An")).toBeTruthy();
  fireEvent.click(details.getByRole("button", { name: "Sửa hồ sơ bệnh nhân" }));
  expect(await screen.findByRole("dialog", { name: "Chỉnh sửa bệnh nhân" })).toBeTruthy();
});

it("queues the hospital workbook, previews rows, and reopens completed rows from history", async () => {
  const calls: string[] = [];
  const previewJob = { _id: "p1", filename: "Lượt khám.xlsx", kind: "hospital-report", status: "preview", phase: "check",
    total: 1, ready: 1, patientsReady: 1, duplicates: 0, invalid: 0, processed: 0 };
  const completedJob = { ...previewJob, status: "completed", phase: "write", processed: 1, inserted: 1, patientsInserted: 1, skipped: 0 };
  let committed = false;
  vi.stubGlobal("fetch", async (url: string) => {
    const path = url.replace("/api/v1/healthcare", "").split("?")[0];
    calls.push(path);
    if (path === "/imports") return Response.json([completedJob]);
    if (path === "/catalog") return Response.json([]);
    if (path === "/imports/preview/hospital-report") return Response.json({ ...previewJob, status: "queued" }, { status: 202 });
    if (path === "/imports/p1") return Response.json(committed ? completedJob : previewJob);
    if (path === "/imports/p1/commit") {
      committed = true;
      return Response.json({ ...previewJob, status: "queued", phase: "write" }, { status: 202 });
    }
    if (path === "/imports/p1/rows/search") return Response.json({ items: [
      { index: 0, row: 5, sheet: "Tháng 10", code: "QA001", label: "BN001", preview: { ma_phieu: "QA001", ten_benh_nhan: "Nguyễn QA" }, status: committed ? "imported" : "ready", ...(committed ? { recordId: "a1" } : {}) },
    ], total: 1, page: 1, pageSize: 25 });
    return Response.json({ items: [], total: 0, patientReferences: [] });
  });
  render(<HealthcareWorkspace branchId="branch-a" hasPermission={() => true} />);
  fireEvent.click(screen.getByRole("button", { name: "Lượt khám" }));
  fireEvent.click(screen.getByRole("button", { name: "Nhập Excel" }));
  const importer = within(screen.getByRole("dialog", { name: "Nhập dữ liệu Excel" }));
  expect(importer.getByRole("button", { name: /Toàn bộ workbook y tế/ }).getAttribute("aria-pressed")).toBe("true");
  expect((importer.getByRole("button", { name: "Tải lên và kiểm tra" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(importer.getByLabelText("File Excel"), { target: { files: [hospitalWorkbookFile()] } });
  const preview = importer.getByRole<HTMLButtonElement>("button", { name: "Tải lên và kiểm tra" });
  await waitFor(() => expect(preview.disabled).toBe(false));
  fireEvent.submit(preview.form!);
  expect(await importer.findByText("Nguyễn QA")).toBeTruthy();
  fireEvent.click(importer.getByRole("button", { name: "Xác nhận nhập" }));
  expect(calls).not.toContain("/imports/p1/commit");
  const confirmation = within(screen.getByRole("alertdialog", { name: "Xác nhận nhập Excel" }));
  fireEvent.click(confirmation.getByRole("button", { name: "Đưa vào hàng đợi" }));
  expect(await importer.findByRole("button", { name: "Mở phiếu khám" })).toBeTruthy();
  await waitFor(() => expect(calls.filter(path => path === "/visits")).toHaveLength(2));
  fireEvent.click(importer.getByRole("button", { name: "Đóng" }));
  fireEvent.click(screen.getByRole("button", { name: "Nhập Excel" }));
  const reopened = within(screen.getByRole("dialog", { name: "Nhập dữ liệu Excel" }));
  fireEvent.click(reopened.getByRole("button", { name: "Lịch sử" }));
  fireEvent.click(await reopened.findByRole("button", { name: "Xem chi tiết" }));
  expect(await reopened.findByRole("button", { name: "Mở phiếu khám" })).toBeTruthy();
});

it("applies the shared date and search filters to the server-side visit list", async () => {
  const search = vi.fn();
  vi.stubGlobal("fetch", async (url: string, options: RequestInit) => {
    if (url.endsWith("/catalog")) return Response.json([]);
    if (url.endsWith("/visits/search")) search(JSON.parse(String(options.body)));
    return Response.json({ items: [], total: 0, patientReferences: [] });
  });
  render(<HealthcareWorkspace branchId="branch-a" hasPermission={() => true} />);
  fireEvent.click(screen.getByRole("button", { name: "Lượt khám" }));
  fireEvent.click(screen.getByRole("button", { name: "Hôm nay" }));
  vi.useFakeTimers();
  fireEvent.change(screen.getByRole("textbox", { name: /Tìm mã phiếu/ }), { target: { value: "BS QA" } });
  await act(async () => { await vi.advanceTimersByTimeAsync(999); });
  expect(search).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(search).toHaveBeenCalledWith(expect.objectContaining({
    page: "1", q: "BS QA", from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  }));
  vi.useRealTimers();
  const [[query]] = search.mock.calls;
  expect(query.from).toBe(query.to);
});

it("opens the linked appointment in its branch and clears the record filter when showing all", async () => {
  const id = "6f045410-0c40-4aaf-80bb-f2ebcc39eb25";
  window.history.replaceState(null, "", `/quan-ly-y-te?sub=lich-hen&branch=branch-a&id=${id}`);
  const calls: URL[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(new URL(url, window.location.origin));
    return Response.json(url.endsWith("/catalog") ? [] : { items: [], total: 0, patientReferences: [] });
  });
  render(<HealthcareWorkspace branchId="branch-a" hasPermission={() => true} />);
  expect(await screen.findByText("Bản ghi liên quan")).toBeTruthy();
  expect(calls.find(url => url.pathname.endsWith("/appointments"))?.searchParams.get("id")).toBe(id);
  fireEvent.click(screen.getByRole("button", { name: "Xem tất cả" }));
  expect(window.location.search).toBe("?sub=lich-hen");
  expect(calls.filter(url => url.pathname.endsWith("/appointments")).at(-1)?.searchParams.has("id")).toBe(false);
});

it("does not request a record from another branch or a section without permission", async () => {
  const id = "6f045410-0c40-4aaf-80bb-f2ebcc39eb25";
  window.history.replaceState(null, "", `/quan-ly-y-te?sub=lich-hen&branch=branch-a&id=${id}`);
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url);
    return Response.json(url.endsWith("/catalog") ? [] : { items: [], total: 0, patientReferences: [] });
  });
  const view = render(<HealthcareWorkspace branchId="branch-b" hasPermission={() => true} />);
  expect(await screen.findByText("Chưa có dữ liệu phù hợp.")).toBeTruthy();
  expect(calls.some(url => url.includes(id))).toBe(false);

  view.unmount();
  calls.length = 0;
  render(<HealthcareWorkspace branchId="branch-a" hasPermission={code => code === "healthcare:read"} />);
  expect(await screen.findByText("Chưa có dữ liệu phù hợp.")).toBeTruthy();
  const menu = within(screen.getByRole("navigation", { name: "Nghiệp vụ y tế" }));
  expect(menu.getAllByRole("button")).toHaveLength(1);
  expect(menu.getByRole("button", { name: "Bệnh nhân" }).getAttribute("aria-current")).toBe("page");
  expect(calls).toEqual(["/api/v1/healthcare/patients/search"]);
});

it("includes the catalog in the shared module sidebar and keeps it selected after collapse", async () => {
  vi.stubGlobal("fetch", async (url: string) =>
    Response.json(url.endsWith("/catalog") ? [] : { items: [], total: 0 }));
  render(<HealthcareWorkspace branchId="branch-a" hasPermission={() => true} />);
  const menu = within(screen.getByRole("navigation", { name: "Nghiệp vụ y tế" }));
  const settings = menu.getByRole("button", { name: "Cài đặt danh mục" });
  fireEvent.click(settings);
  expect(await screen.findByRole("heading", { name: "Danh mục y tế" })).toBeTruthy();
  expect(window.location.search).toBe("?sub=danh-muc");
  expect(settings.getAttribute("aria-current")).toBe("page");
  expect(settings.querySelector(".module-nav-filled svg")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Thu gọn thanh điều hướng" }));
  expect(menu.getByRole("button", { name: "Cài đặt danh mục" }).getAttribute("aria-current")).toBe("page");
});
