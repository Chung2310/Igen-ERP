// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { uid: "u1", role: "employee", displayName: "Nhân viên", email: "staff@example.com" }, logout: vi.fn() }),
}));
vi.mock("../context/BranchContext", () => ({
  useBranch: () => ({ branches: [], activeBranchId: "", setActiveBranchId: vi.fn(), activeBranch: null }),
}));
vi.mock("../services/authService", () => ({ authService: {} }));
vi.mock("../services/notificationService", () => ({
  notificationService: { getNotifications: vi.fn().mockResolvedValue({ data: [], unreadCount: 0 }) },
}));
vi.mock("../services/socketService", () => ({ socketService: { on: vi.fn(() => vi.fn()) } }));
vi.mock("./Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../components/attendance/AttendanceCameraModal", () => ({
  default: () => <div data-testid="header-attendance-camera">camera</div>,
}));

import Header from "./Header";

describe("Header attendance with face checking disabled", () => {
  beforeEach(() => {
    localStorage.setItem("accessToken", "token");
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({ coords: { latitude: 10.7, longitude: 106.6 } } as GeolocationPosition),
      },
    });
    vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => ({
      ok: true,
      json: async () => init?.method === "POST" ? ({ message: "Đã check-in" }) : ({ data: { log: null } }),
    })));
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("posts coordinates without opening the camera or attaching an image", async () => {
    const user = userEvent.setup();
    render(<Header currentTab={"TỔNG QUAN" as never} onSearchSelect={vi.fn()} />);
    const checkIn = screen.getAllByRole("button", { name: /Check-In/i })[0];
    await user.click(checkIn);

    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    expect(screen.queryByTestId("header-attendance-camera")).toBeNull();
    const postCall = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST");
    const body = postCall?.[1]?.body as FormData;
    expect(body.get("latitude")).toBe("10.7");
    expect(body.get("longitude")).toBe("106.6");
    expect(body.has("file")).toBe(false);
  });
});
