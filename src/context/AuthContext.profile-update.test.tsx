// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "../services/authService";
import { socketService } from "../services/socketService";
import type { UserProfile } from "../types";
import { AuthProvider, useAuth } from "./AuthContext";

vi.mock("../services/authService", () => ({
  authService: { getMe: vi.fn(), updateProfile: vi.fn(), uploadAvatar: vi.fn() },
}));
vi.mock("../services/socketService", () => ({
  socketService: { on: vi.fn(), onStatusChange: vi.fn() },
}));
vi.mock("../pages/Toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("../modules/student-management/hooks/entityPresetStore", () => ({
  ensureEntityPresetLoaded: vi.fn(() => Promise.resolve()),
  setEntityPresetScope: vi.fn(),
}));

const fullProfile = {
  uid: "user-1",
  email: "user@acme.test",
  displayName: "User",
  role: "admin" as const,
  companyCode: "ACME",
  permissions: ["hr.view"],
  enabledModules: ["hr"],
  businessType: "labor" as const,
  createdAt: "2026-10-17",
};

function ProfileProbe() {
  const { userProfile, hasPermission, isModuleEnabled, uploadAvatar, updateProfileInfo } = useAuth();
  return <>
    <output aria-label="access">{`${hasPermission("hr.view")}:${isModuleEnabled("hr")}`}</output>
    <output aria-label="avatar">{userProfile?.photoURL || "none"}</output>
    <output aria-label="name">{userProfile?.displayName || "none"}</output>
    <button onClick={() => void uploadAvatar(new File(["image"], "avatar.png", { type: "image/png" }))}>Upload avatar</button>
    <button onClick={() => void updateProfileInfo("Updated User", "https://example.test/profile.png")}>Update profile</button>
  </>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authService.getMe).mockResolvedValue(fullProfile);
  vi.mocked(authService.uploadAvatar).mockResolvedValue({ url: "https://example.test/avatar.png", uploadToken: "token" });
  vi.mocked(authService.updateProfile).mockImplementation(async (data) => ({
    uid: "user-1",
    email: fullProfile.email,
    displayName: data.displayName || fullProfile.displayName,
    role: fullProfile.role,
    photoURL: data.photoURL,
    createdAt: fullProfile.createdAt,
  } as UserProfile));
  vi.mocked(socketService.on).mockReturnValue(() => undefined);
  vi.mocked(socketService.onStatusChange).mockReturnValue(() => undefined);
});
afterEach(cleanup);

describe("personal profile updates", () => {
  it.each([
    { action: "Upload avatar", expectedAvatar: "https://example.test/avatar.png", expectedName: "User" },
    { action: "Update profile", expectedAvatar: "https://example.test/profile.png", expectedName: "Updated User" },
  ])("keeps sidebar access after $action", async ({ action, expectedAvatar, expectedName }) => {
    render(<AuthProvider><ProfileProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByLabelText("access").textContent).toBe("true:true"));

    await act(async () => screen.getByRole("button", { name: action }).click());

    expect(screen.getByLabelText("access").textContent).toBe("true:true");
    expect(screen.getByLabelText("avatar").textContent).toBe(expectedAvatar);
    expect(screen.getByLabelText("name").textContent).toBe(expectedName);
  });
});
