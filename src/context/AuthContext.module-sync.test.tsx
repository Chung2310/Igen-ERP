// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "../services/authService";
import { socketService } from "../services/socketService";
import { toast } from "../pages/Toast";
import { ensureEntityPresetLoaded } from "../modules/student-management/hooks/entityPresetStore";
import { AuthProvider, useAuth } from "./AuthContext";

vi.mock("../services/authService", () => ({
  authService: { getMe: vi.fn() },
}));

vi.mock("../services/socketService", () => ({
  socketService: { on: vi.fn(), onStatusChange: vi.fn() },
}));

vi.mock("../pages/Toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../modules/student-management/hooks/entityPresetStore", () => ({
  ensureEntityPresetLoaded: vi.fn(() => Promise.resolve()),
}));

const profile = {
  _id: "user-1",
  uid: "user-1",
  email: "user@acme.test",
  displayName: "User",
  role: "user" as const,
  companyCode: "ACME",
  enabledModules: ["hr", "chat"],
};

function ProfileProbe() {
  const { userProfile } = useAuth();
  return <output aria-label="modules">{userProfile?.enabledModules?.join(",") || "none"}</output>;
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem("accessToken", "token");
  vi.mocked(authService.getMe).mockResolvedValue(profile as any);
  vi.mocked(socketService.on).mockReturnValue(() => undefined);
  vi.mocked(socketService.onStatusChange).mockImplementation((callback: (connected: boolean) => void) => {
    callback(false);
    return () => undefined;
  });
});

describe("AuthContext company module sync", () => {
  it("preloads the student entity preset after restoring the signed-in profile", async () => {
    render(<AuthProvider><ProfileProbe /></AuthProvider>);

    await waitFor(() => expect(screen.getByLabelText("modules").textContent).toBe("hr,chat"));

    expect(ensureEntityPresetLoaded).toHaveBeenCalledTimes(1);
  });
  it("applies a valid event for the signed-in company immediately", async () => {
    render(<AuthProvider><ProfileProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByLabelText("modules").textContent).toBe("hr,chat"));

    expect(socketService.on).toHaveBeenCalledWith("company_modules_updated", expect.any(Function));
    const listener = vi.mocked(socketService.on).mock.calls.find(([event]) => event === "company_modules_updated")?.[1];
    await act(async () => listener?.({ companyCode: "ACME", enabledModules: ["inventory"] }));

    expect(screen.getByLabelText("modules").textContent).toBe("inventory");
    expect(toast.success).toHaveBeenCalledWith("Quyền truy cập module của doanh nghiệp vừa được cập nhật.");
  });

  it("ignores events for another company", async () => {
    render(<AuthProvider><ProfileProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByLabelText("modules").textContent).toBe("hr,chat"));
    const listener = vi.mocked(socketService.on).mock.calls.find(([event]) => event === "company_modules_updated")?.[1];
    await act(async () => listener?.({ companyCode: "OTHER", enabledModules: ["inventory"] }));
    expect(screen.getByLabelText("modules").textContent).toBe("hr,chat");
  });
  it("refreshes the authenticated profile when the socket connects again", async () => {
    let statusListener: ((connected: boolean) => void) | undefined;
    vi.mocked(socketService.onStatusChange).mockImplementation((callback: (connected: boolean) => void) => {
      statusListener = callback;
      callback(false);
      return () => undefined;
    });
    render(<AuthProvider><ProfileProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByLabelText("modules").textContent).toBe("hr,chat"));

    vi.mocked(authService.getMe).mockResolvedValue({ ...profile, enabledModules: ["student"] } as any);
    await act(async () => statusListener?.(true));

    await waitFor(() => expect(screen.getByLabelText("modules").textContent).toBe("student"));
  });
});
