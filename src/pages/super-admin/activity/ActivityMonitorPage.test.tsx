// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityMonitorPage } from "./ActivityMonitorPage";
import { activityMonitorService } from "../../../services/activityMonitorService";
import { superAdminTenantService } from "../../../services/superAdminTenantService";

vi.mock("../../../services/activityMonitorService", () => ({ activityMonitorService: { list: vi.fn(), accounts: vi.fn() } }));
vi.mock("../../../services/superAdminTenantService", () => ({ superAdminTenantService: { list: vi.fn() } }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(superAdminTenantService.list).mockResolvedValue([{ code: "ACME", name: "Công ty A" }, { code: "OTHER", name: "Công ty B" }]);
  vi.mocked(activityMonitorService.accounts).mockResolvedValue([{ _id: "user-a", displayName: "Nguyễn An", email: "an@acme.test", companyCode: "ACME", role: "admin" }]);
  vi.mocked(activityMonitorService.list).mockResolvedValue({
    data: [{ eventId: "event-1", userId: "user-a", companyCode: "ACME", actorName: "Nguyễn An", actorEmail: "an@acme.test", actionType: "company.create", description: "Tạo doanh nghiệp và chi nhánh", category: "data", result: "failure", occurredAt: "2026-10-23T09:30:00Z", statusCode: 403, correlationId: "trace-1" }],
    total: 1, page: 1, limit: 30, summary: { failures: 1, companies: 1, activeUsers: 1 }, generatedAt: "2026-10-23T09:30:01Z", retentionDays: 90,
  });
});
describe("ActivityMonitorPage", () => {
  it("shows actor, outcome and expandable operational details", async () => {
    render(<ActivityMonitorPage />);
    expect(await screen.findByText("Tạo doanh nghiệp và chi nhánh")).toBeTruthy();
    expect(screen.getByText("Nguyễn An · an@acme.test")).toBeTruthy();
    expect(screen.getByText("403")).toBeTruthy();
    expect(screen.getByText("trace-1")).toBeTruthy();
    expect(screen.getByText(/Tự cập nhật mỗi 3 giây/)).toBeTruthy();
  });
  it("drills into an actor and clears the actor when changing company", async () => {
    render(<ActivityMonitorPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Theo dõi tài khoản an@acme.test" }));
    await waitFor(() => expect(activityMonitorService.list).toHaveBeenLastCalledWith(expect.objectContaining({ companyCode: "ACME", userId: "user-a", page: 1 }), expect.any(AbortSignal)));
    fireEvent.change(screen.getByLabelText("Doanh nghiệp"), { target: { value: "OTHER" } });
    await waitFor(() => expect(activityMonitorService.list).toHaveBeenLastCalledWith(expect.objectContaining({ companyCode: "OTHER", userId: "", page: 1 }), expect.any(AbortSignal)));
    expect((screen.getByLabelText("Tài khoản") as HTMLSelectElement).value).toBe("");
  });
  it("shows an explicit empty state with a reset action", async () => {
    vi.mocked(activityMonitorService.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 30, summary: { failures: 0, companies: 0, activeUsers: 0 }, generatedAt: "2026-10-23T09:30:01Z", retentionDays: 90 });
    render(<ActivityMonitorPage />);
    expect(await screen.findByText("Chưa có hoạt động phù hợp với bộ lọc.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Đặt lại bộ lọc" })).toHaveLength(2);
  });
  it("reports load errors inline and offers retry", async () => {
    vi.mocked(activityMonitorService.list).mockRejectedValue(new Error("Phiên quản trị đã hết hạn"));
    render(<ActivityMonitorPage />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Phiên quản trị đã hết hạn/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    await waitFor(() => expect(activityMonitorService.list).toHaveBeenCalledTimes(2));
  });
});
