// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { superAdminUserAccessService } from "../../../services/superAdminUserAccessService";
import { UserActivityTimeline } from "./UserActivityTimeline";

vi.mock("../../../services/superAdminUserAccessService", () => ({
  superAdminUserAccessService: { activity: vi.fn() },
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(superAdminUserAccessService.activity).mockResolvedValue({
    data: [
      { eventId: "1", userId: "user-1", companyCode: "ACME", actionType: "user.update", category: "data", result: "success", description: "Cập nhật người dùng", occurredAt: "2026-07-22T09:00:00.000Z" },
      { eventId: "2", userId: "user-1", companyCode: "ACME", actionType: "auth.login", category: "authentication", result: "failure", description: "Đăng nhập thất bại", occurredAt: "2026-07-21T09:00:00.000Z" },
    ], total: 2, page: 1, limit: 20,
  });
});

describe("UserActivityTimeline", () => {
  it("loads and groups meaningful activity by day", async () => {
    render(<UserActivityTimeline tenantId="ACME" userId="user-1" />);
    expect(await screen.findByText("Cập nhật người dùng")).toBeTruthy();
    expect(screen.getByText("Đăng nhập thất bại")).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 5 })).toHaveLength(2);
    expect(superAdminUserAccessService.activity).toHaveBeenCalledWith("ACME", "user-1", expect.objectContaining({ page: 1, limit: 20 }));
  });

  it("reloads when the category filter changes", async () => {
    render(<UserActivityTimeline tenantId="ACME" userId="user-1" />);
    await screen.findByText("Cập nhật người dùng");
    fireEvent.change(screen.getByLabelText("Loại hoạt động"), { target: { value: "security" } });
    await waitFor(() => expect(superAdminUserAccessService.activity).toHaveBeenLastCalledWith("ACME", "user-1", expect.objectContaining({ category: "security", page: 1 })));
  });
});
