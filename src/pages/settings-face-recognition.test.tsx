// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const authState = vi.hoisted(() => ({
  userProfile: null as unknown,
  uploadAvatar: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("../components/settings/ProfileTab", () => ({ default: () => <div>PROFILE_TAB</div> }));
vi.mock("../components/settings/SecurityTab", () => ({ default: () => <div /> }));
vi.mock("../components/settings/ErpConfigTab", () => ({ default: () => <div /> }));
vi.mock("../components/settings/GoogleDriveTab", () => ({ default: () => <div /> }));
vi.mock("../components/settings/FaceRecognitionSettingsTab", () => ({
  default: () => <div>FACE_TAB</div>,
}));

import SettingsTab from "./SettingsTab";

describe("SettingsTab face recognition navigation", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the tab button for admins", async () => {
    authState.userProfile = { role: "admin", permissions: [] };
    render(<SettingsTab />);
    expect(screen.getByRole("button", { name: "Nhận diện khuôn mặt" })).toBeTruthy();
  });

  it("shows the tab button with the access:manage permission", () => {
    authState.userProfile = { role: "user", permissions: ["access:manage"] };
    render(<SettingsTab />);
    expect(screen.getByRole("button", { name: "Nhận diện khuôn mặt" })).toBeTruthy();
  });

  it("hides the tab button for unauthorized users", () => {
    authState.userProfile = { role: "user", permissions: [] };
    render(<SettingsTab />);
    expect(screen.queryByRole("button", { name: "Nhận diện khuôn mặt" })).toBeNull();
  });

  it("deep link renders the face tab for admins", async () => {
    authState.userProfile = { role: "admin", permissions: [] };
    window.history.replaceState(null, "", "/?sub=nhan-dien-khuon-mat");
    render(<SettingsTab />);
    expect(await screen.findByText("FACE_TAB")).toBeTruthy();
  });

  it("deep link falls back to profile for unauthorized users", async () => {
    authState.userProfile = { role: "user", permissions: [] };
    window.history.replaceState(null, "", "/?sub=nhan-dien-khuon-mat");
    render(<SettingsTab />);
    expect(await screen.findByText("PROFILE_TAB")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("FACE_TAB")).toBeNull());
  });
});
