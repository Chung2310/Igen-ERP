// @vitest-environment jsdom
import React from "react";
import fs from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const workersHook = vi.hoisted(() => ({ useWorkers: vi.fn() }));
vi.mock("../hooks/useWorkers", () => workersHook);
// The add modal now renders the shared shell, which reads auth for
// custom-field management and mounts the shared custom-field section.
vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { permissions: ["people:manage"] } }),
}));
vi.mock("../../student-management/custom-fields/CustomFieldsSection", () => ({
  CustomFieldsSection: () => null,
}));
import WorkersPage from "./WorkersPage";
import { workerApi } from "../api/workers.api";
import { toast } from "../../../pages/Toast";

const worker = {
  _id: "worker-1",
  fullName: "Nguyễn Văn A",
  phone: "0901",
  status: "active" as const,
  registrationDate: "01/08/2026",
  projectIds: ["project-1"],
};
const state = (overrides: Record<string, unknown> = {}) => ({ workers: [worker], loading: false, error: null, createWorker: vi.fn().mockResolvedValue(worker), updateWorker: vi.fn().mockResolvedValue(worker), deleteWorker: vi.fn().mockResolvedValue(worker), importWorkers: vi.fn().mockResolvedValue({ importedCount: 0, skippedCount: 0, errors: [] }), reload: vi.fn(), ...overrides });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("worker profile ownership", () => {
  beforeEach(() => {
    localStorage.setItem("accessToken", "worker-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ workers: [] }) }));
  });

  it("calls the direct worker profile endpoint with authentication", async () => {
    await workerApi.list({ companyCode: "ACME", branchId: "branch-1" });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/worker-management/workers"), expect.objectContaining({ headers: expect.any(Headers) }));
    expect(vi.mocked(fetch).mock.calls[0][0]).toEqual(expect.stringContaining("companyCode=ACME"));
    expect(vi.mocked(fetch).mock.calls[0][0]).toEqual(expect.stringContaining("branchId=branch-1"));
    const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer worker-token");
  });

  it("uses direct worker URLs for create, update, and soft-delete", async () => {
    const response = (body: object) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
    vi.mocked(fetch).mockResolvedValueOnce(response({ worker }));
    vi.mocked(fetch).mockResolvedValueOnce(response({ worker }));
    vi.mocked(fetch).mockResolvedValueOnce(response({ worker }));
    const scope = { companyCode: "ACME", branchId: "branch-1" };
    await workerApi.create({ fullName: worker.fullName, status: "active" }, scope);
    await workerApi.update(worker._id, { fullName: worker.fullName, status: "active" }, scope);
    await workerApi.delete(worker._id, scope);
    expect(vi.mocked(fetch).mock.calls.slice(-3)).toEqual([
      [expect.stringMatching(/\/api\/v1\/worker-management\/workers\?.*companyCode=ACME.*branchId=branch-1/), expect.objectContaining({ method: "POST" })],
      [expect.stringMatching(/\/api\/v1\/worker-management\/workers\/worker-1\?.*companyCode=ACME.*branchId=branch-1/), expect.objectContaining({ method: "PATCH" })],
      [expect.stringMatching(/\/api\/v1\/worker-management\/workers\/worker-1\?.*companyCode=ACME.*branchId=branch-1/), expect.objectContaining({ method: "DELETE" })],
    ]);
  });
  it("has a worker-owned page for profile list states and modal lifecycle", () => {
    expect(fs.existsSync("src/modules/worker-management/pages/WorkersPage.tsx")).toBe(true);
  });

  it.each([
    ["loading", state({ workers: [], loading: true }), "Đang nạp dữ liệu..."],
    ["empty", state({ workers: [] }), "Không tìm thấy Lao động nào phù hợp với bộ lọc."],
    ["error", state({ workers: [], error: "Không thể tải danh sách lao động." }), "Không thể tải danh sách lao động."],
  ])("shows the %s list state", (_name, hookValue, expected) => {
    workersHook.useWorkers.mockReturnValue(hookValue);
    render(<WorkersPage />);
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it("passes a typed company scope to the worker hook", () => {
    workersHook.useWorkers.mockReturnValue(state());
    render(<WorkersPage selectedCenter="ACME" />);
    expect(workersHook.useWorkers).toHaveBeenCalledWith({ companyCode: "ACME" });
  });

  it("preserves worker-preset actions, control order, classes, and filters", async () => {
    workersHook.useWorkers.mockReturnValue(state());
    const { container } = render(
      <WorkersPage selectedCenter="ACME" registrationOwnerId="owner-1" projects={[{ id: "project-1", name: "Dự án Alpha" }]} />,
    );
    const actions = Array.from(container.querySelectorAll("button"))
      .map((button) => button.textContent?.trim())
      .filter((label) => ["Xuất", "In", "QR đăng ký", "Thêm"].includes(label || ""));
    expect(actions).toEqual(["Xuất", "In", "QR đăng ký", "Thêm"]);
    expect(screen.getByRole("button", { name: "Xuất" }).className).toContain("border-slate-200");
    expect(screen.getByRole("button", { name: "Thêm" }).className).toContain("bg-brand-primary");
    expect(container.querySelector(".status-tabs")).toBeTruthy();
    expect(container.querySelector(".filters-bar")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Đang tuyển/ })).toBeTruthy();
    expect(screen.getByLabelText("Dự án")).toBeTruthy();
    expect(screen.getByLabelText("Từ ngày")).toBeTruthy();
    expect(screen.getByLabelText("Đến ngày")).toBeTruthy();
    expect(screen.getByLabelText("Từ ngày").getAttribute("type")).toBe("date");
    expect(screen.getByLabelText("Đến ngày").getAttribute("type")).toBe("date");
    await userEvent.selectOptions(screen.getByLabelText("Dự án"), "unassigned");
    expect(screen.getByText("Không tìm thấy Lao động nào phù hợp với bộ lọc.")).toBeTruthy();
  });

  it("closes the add modal after a successful create and opens its worker detail", async () => {
    const hookValue = state();
    workersHook.useWorkers.mockReturnValue(hookValue);
    render(<WorkersPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Thêm/ }));
    await user.type(screen.getByLabelText("Họ và tên *"), "Trần Thị B");
    await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(hookValue.createWorker).toHaveBeenCalled());
    expect(screen.queryByText("Thêm lao động mới")).toBeNull();
    expect(screen.getByRole("heading", { name: "Nguyễn Văn A" })).toBeTruthy();
  });

  it("discards an unfinished add form after cancel and reopen", async () => {
    workersHook.useWorkers.mockReturnValue(state());
    render(<WorkersPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Thêm/ }));
    await user.type(screen.getByLabelText("Họ và tên *"), "Bản nháp");
    await user.click(screen.getByRole("button", { name: "Hủy" }));
    await user.click(screen.getByRole("button", { name: /Thêm/ }));
    expect((screen.getByLabelText("Họ và tên *") as HTMLInputElement).value).toBe("");
  });

  it("preserves configurable required-field validation", async () => {
    const hookValue = state();
    workersHook.useWorkers.mockReturnValue(hookValue);
    render(<WorkersPage profileFields={[{ key: "phone", label: "Số điện thoại", isRequired: true, isVisible: true }]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Thêm/ }));
    await user.type(screen.getByLabelText("Họ và tên *"), "Trần Thị B");
    await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(screen.getByText(/các trường bắt buộc: Số điện thoại/)).toBeTruthy();
    expect(hookValue.createWorker).not.toHaveBeenCalled();
  });

  it("rejects duplicate worker phone, email, and identity fields before submit", async () => {
    const hookValue = state();
    workersHook.useWorkers.mockReturnValue(hookValue);
    render(<WorkersPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Thêm/ }));
    await user.type(screen.getByLabelText("Họ và tên *"), "Trần Thị B");
    await user.type(screen.getByLabelText("Số điện thoại"), "0901");
    await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(screen.getByText("Số điện thoại đã tồn tại trong hệ thống, không được trùng.")).toBeTruthy();
    expect(hookValue.createWorker).not.toHaveBeenCalled();
  });

  it("uses the soft-delete mutation from the worker hook", async () => {
    const hookValue = state();
    workersHook.useWorkers.mockReturnValue(hookValue);
    render(<WorkersPage />);
    const user = userEvent.setup();
    await user.click(screen.getByTitle("Xóa"));
    await user.click(screen.getAllByRole("button", { name: "Xóa" }).at(-1)!);
    await waitFor(() => expect(hookValue.deleteWorker).toHaveBeenCalledWith("worker-1"));
  });

  it("updates worker detail through the worker hook", async () => {
    const hookValue = state();
    workersHook.useWorkers.mockReturnValue(hookValue);
    render(<WorkersPage />);
    const user = userEvent.setup();
    await user.click(screen.getByTitle("Sửa thông tin"));
    expect(screen.getByRole("button", { name: "Hủy sửa" })).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("Nguyễn Văn A"), { target: { value: "Nguyễn Văn B" } });
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(hookValue.updateWorker).toHaveBeenCalledWith("worker-1", expect.objectContaining({ fullName: "Nguyễn Văn B" })));
  });

  it("applies configurable required-field validation when editing a worker", async () => {
    const hookValue = state();
    const errorToast = vi.spyOn(toast, "error");
    workersHook.useWorkers.mockReturnValue(hookValue);
    const { container } = render(
      <WorkersPage
        profileFields={[{ key: "phone", label: "Required phone", isRequired: true, isVisible: true }]}
      />,
    );
    const user = userEvent.setup();
    await user.click(container.querySelector("tbody button[title]") as HTMLElement);
    const modal = container.querySelector(".fixed.z-\\[60\\]") as HTMLElement;
    await user.click(modal.querySelector(".border-b button") as HTMLElement);
    fireEvent.change(modal.querySelector('input[name="phone"]') as HTMLInputElement, {
      target: { value: "" },
    });
    fireEvent.submit(modal.querySelector("form") as HTMLFormElement);
    expect(errorToast).toHaveBeenCalledWith(expect.stringContaining("Required phone"));
    expect(hookValue.updateWorker).not.toHaveBeenCalled();
  });

  it("rejects duplicate profile values when editing a worker", async () => {
    const otherWorker = { ...worker, _id: "worker-2", fullName: "Other Worker", phone: "0902" };
    const errorToast = vi.spyOn(toast, "error");
    const hookValue = state({ workers: [worker, otherWorker] });
    workersHook.useWorkers.mockReturnValue(hookValue);
    const { container } = render(<WorkersPage />);
    const user = userEvent.setup();
    await user.click(container.querySelector("tbody button[title]") as HTMLElement);
    const modal = container.querySelector(".fixed.z-\\[60\\]") as HTMLElement;
    await user.click(modal.querySelector(".border-b button") as HTMLElement);
    fireEvent.change(modal.querySelector('input[name="phone"]') as HTMLInputElement, {
      target: { value: "0902" },
    });
    fireEvent.submit(modal.querySelector("form") as HTMLFormElement);
    expect(errorToast).toHaveBeenCalledWith(expect.stringContaining("đã tồn tại"));
    expect(hookValue.updateWorker).not.toHaveBeenCalled();
  });
});

  it("renders editable controls for configurable profile fields before validating them", async () => {
    const hookValue = state();
    workersHook.useWorkers.mockReturnValue(hookValue);
    const { container } = render(
      <WorkersPage
        profileFields={[
          { key: "note", label: "Required note", isRequired: true, isVisible: true },
          {
            key: "registrationDate",
            label: "Registration date",
            isRequired: false,
            isVisible: true,
          },
        ]}
      />,
    );
    const user = userEvent.setup();
    await user.click(container.querySelector("tbody button[title]") as HTMLElement);
    const modal = container.querySelector(".fixed.z-\\[60\\]") as HTMLElement;
    await user.click(modal.querySelector(".border-b button") as HTMLElement);
    const note = modal.querySelector('input[name="note"]') as HTMLInputElement;
    expect(note).toBeTruthy();
    expect(modal.querySelector('input[name="registrationDate"]')).toBeTruthy();
    fireEvent.change(note, { target: { value: "Ready" } });
    fireEvent.submit(modal.querySelector("form") as HTMLFormElement);
    await waitFor(() =>
      expect(hookValue.updateWorker).toHaveBeenCalledWith(
        "worker-1",
        expect.objectContaining({ note: "Ready" }),
      ),
    );
  });

describe("worker bulk import entry point", () => {
  it("hides the import button from users without manage rights", () => {
    workersHook.useWorkers.mockReturnValue(state());
    render(<WorkersPage canManage={false} />);
    expect(screen.queryByRole("button", { name: /Nhập Excel/ })).toBeNull();
  });

  it("opens the import modal and wires it to the hook", async () => {
    const hookValue = state();
    workersHook.useWorkers.mockReturnValue(hookValue);
    render(<WorkersPage projects={[{ id: "project-1", name: "Dự án Bắc Ninh" }]} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Nhập Excel/ }));
    const dialog = screen.getByRole("dialog", { name: "Nhập danh sách lao động" });
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /Tải file mẫu/ })).toBeTruthy();
    expect(hookValue.importWorkers).not.toHaveBeenCalled();
  });

  it("closes the import modal again", async () => {
    workersHook.useWorkers.mockReturnValue(state());
    render(<WorkersPage />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Nhập Excel/ }));
    await user.click(screen.getByRole("button", { name: "Đóng" }));
    expect(screen.queryByRole("dialog", { name: "Nhập danh sách lao động" })).toBeNull();
  });
});
