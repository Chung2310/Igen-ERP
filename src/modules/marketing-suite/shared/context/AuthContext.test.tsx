// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useAuth } from "./AuthContext";

const state = vi.hoisted(() => ({
  userProfile: { uid: "user", role: "user", permissions: ["marketing:manage"] },
  refreshProfile: vi.fn(),
}));
vi.mock("../../../../context/AuthContext", () => ({ useAuth: () => state }));
vi.mock("../../../../services/authService", () => ({ getAccessToken: () => "test-session" }));
afterEach(cleanup);

it("keeps the adapted profile and callbacks stable across local renders", () => {
  const { result, rerender } = renderHook(() => useAuth());
  const first = result.current;
  rerender();
  expect(result.current.userProfile).toBe(first.userProfile);
  expect(result.current.user).toBe(first.userProfile);
  expect(result.current.updateAiAutoReplyConfig).toBe(first.updateAiAutoReplyConfig);
  expect(result.current.userProfile?.permissions).toContain("marketing:post");
  expect(state.userProfile.permissions).toEqual(["marketing:manage"]);
});

it("updates the adapted profile when ERP provides a new profile", () => {
  const { result, rerender } = renderHook(() => useAuth());
  const first = result.current.userProfile;
  state.userProfile = { ...state.userProfile, uid: "changed-user" };
  rerender();
  expect(result.current.userProfile).not.toBe(first);
  expect(result.current.userProfile?.uid).toBe("changed-user");
});
