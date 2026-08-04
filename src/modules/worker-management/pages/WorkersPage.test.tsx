// @vitest-environment jsdom
import React from "react";
import fs from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const workersHook = vi.hoisted(() => ({ useWorkers: vi.fn() }));
vi.mock("../hooks/useWorkers", () => workersHook);
import WorkersPage from "./WorkersPage";
import { workerApi } from "../api/workers.api";

const worker = { _id: "worker-1", fullName: "Nguyễn Văn A", phone: "0901", status: "active" as const, registrationDate: "01/08/2026" };
const state = (overrides: Record<string, unknown> = {}) => ({ workers: [worker], loading: false, error: null, createWorker: vi.fn().mockResolvedValue(worker), updateWorker: vi.fn().mockResolvedValue(worker), deleteWorker: vi.fn().mockResolvedValue(worker), reload: vi.fn(), ...overrides });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("worker profile ownership", () => {
  beforeEach(() => {
    localStorage.setItem("accessToken", "worker-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ workers: [] }) }));
  });

  it("calls the direct worker profile endpoint with authentication", async () => {
    await workerApi.list();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/worker-management/workers"), expect.objectContaining({ headers: expect.any(Headers) }));
    const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer worker-token");
  });

  it("uses direct worker URLs for create, update, and soft-delete", async () => {
    const response = (body: object) => ({ ok: true, status: 200, json: async () => body });
    vi.mocked(fetch).mockResolvedValueOnce(response({ worker }));
    vi.mocked(fetch).mockResolvedValueOnce(response({ worker }));
    vi.mocked(fetch).mockResolvedValueOnce(response({ worker }));
    await workerApi.create({ fullName: worker.fullName, status: "active" });
    await workerApi.update(worker._id, { fullName: worker.fullName, status: "active" });
    await workerApi.delete(worker._id);
    expect(vi.mocked(fetch).mock.calls.slice(-3)).toEqual([
      [expect.stringContaining("/api/v1/worker-management/workers"), expect.objectContaining({ method: "POST" })],
      [expect.stringContaining("/api/v1/worker-management/workers/worker-1"), expect.objectContaining({ method: "PATCH" })],
      [expect.stringContaining("/api/v1/worker-management/workers/worker-1"), expect.objectContaining({ method: "DELETE" })],
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
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    fireEvent.change(screen.getByDisplayValue("Nguyễn Văn A"), { target: { value: "Nguyễn Văn B" } });
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(hookValue.updateWorker).toHaveBeenCalledWith("worker-1", expect.objectContaining({ fullName: "Nguyễn Văn B" })));
  });
});