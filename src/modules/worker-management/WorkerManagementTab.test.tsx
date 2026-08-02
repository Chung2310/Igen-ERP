// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workerApi } from "./api/workers.api";
import WorkerManagementTab from "./WorkerManagementTab";
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { permissions: ["worker:read", "worker:manage"] } }) }));
vi.mock("./api/workers.api", () => ({ workerApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(workerApi.list).mockResolvedValue([]); });
describe("WorkerManagementTab", () => {
  it("renders the empty worker module", async () => {
    render(<WorkerManagementTab />);
    expect(screen.getByText("Quản lý lao động")).toBeTruthy();
    expect(await screen.findByText("Chưa có lao động nào.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Thêm lao động/ })).toBeTruthy();
  });
});
