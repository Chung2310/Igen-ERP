// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import UserSubscriptionAssignmentPanel from "./UserSubscriptionAssignmentPanel";
import { aiSubscriptionAdminService } from "../../../services/aiSubscriptionService";
import { superAdminUserAccessService } from "../../../services/superAdminUserAccessService";

vi.mock("../../../services/aiSubscriptionService", () => ({ aiSubscriptionAdminService: { userCurrent: vi.fn(), assignUser: vi.fn(), cancelUser: vi.fn() }, formatAiPlanPrice: (value: number) => String(value) }));
vi.mock("../../../services/superAdminUserAccessService", () => ({ superAdminUserAccessService: { search: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("finds a user and grants an individual AI plan", async () => {
  vi.mocked(superAdminUserAccessService.search).mockResolvedValue({ data: [{ _id: "507f1f77bcf86cd799439011", email: "user@example.com", role: "user" }], total: 1, page: 1, limit: 20 });
  vi.mocked(aiSubscriptionAdminService.userCurrent).mockResolvedValue(null);
  vi.mocked(aiSubscriptionAdminService.assignUser).mockResolvedValue({ actionId: "assigned" } as any);
  render(<UserSubscriptionAssignmentPanel plans={[{ _id: "507f1f77bcf86cd799439012", code: "BASIC", name: "Cơ bản", description: "", priceVnd: 99000, durationDays: 30, aiLimit: 100, active: true, updatedAt: "2026-10-01" }]} plansLoading={false} plansError="" />);
  fireEvent.change(screen.getByLabelText("Email hoặc tên người dùng"), { target: { value: "user@example.com" } });
  fireEvent.click(screen.getByText("Tìm người dùng"));
  fireEvent.click(await screen.findByText("user@example.com · user@example.com"));
  await screen.findByText("Tài khoản chưa có gói AI riêng.");
  fireEvent.change(screen.getByLabelText("Gói AI"), { target: { value: "507f1f77bcf86cd799439012" } });
  fireEvent.change(screen.getByLabelText("Lý do cấp hoặc thu hồi"), { target: { value: "Cấp thử nghiệm" } });
  fireEvent.click(screen.getByText("Cấp gói cho người dùng"));
  await waitFor(() => expect(aiSubscriptionAdminService.assignUser).toHaveBeenCalledWith(
    "507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012", "Cấp thử nghiệm", null, "2026-10-01",
  ));
});
