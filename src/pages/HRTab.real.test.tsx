// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HRTab from "./HRTab";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { uid: "test", role: "admin", companyCode: "SYSTEM", displayName: "Test", email: "test@example.com" }, hasPermission: () => false }) }));
vi.mock("../context/BranchContext", () => ({ useBranch: () => ({ activeBranchId: null }) }));
vi.mock("../services/authService", () => ({ authService: { getAllUsers: async () => [] }, getAccessToken: () => null }));
vi.mock("../hooks/useMediaQuery", () => ({ useIsMobile: () => false }));

describe("HR page direct link", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/nhan-su?sub=lich");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })));
  });

  it("loads the schedule from its URL without a render error", async () => {
    render(<HRTab />);
    expect(screen.getByRole("link", { name: "Cài đặt hệ thống" }).getAttribute("href")).toBe("/cai-dat?sub=ho-so");
    expect(await screen.findByText("Lịch làm việc", {}, { timeout: 5000 })).toBeTruthy();
  });
});
