// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BranchProvider, useBranch } from "./BranchContext";

let profile = { uid: "u1", companyCode: "ACME", role: "admin", branchId: "" };
vi.mock("./AuthContext", () => ({ useAuth: () => ({ userProfile: profile }) }));
vi.mock("../services/authService", () => ({ getAccessToken: () => localStorage.getItem("accessToken") }));

function Probe() {
  const { loading, error, activeBranchId } = useBranch();
  return <output>{loading ? "loading" : error || activeBranchId}</output>;
}
const success = (id: string) => new Response(JSON.stringify({ data: [{ _id: id, isActive: true }] }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  localStorage.clear();
  localStorage.setItem("accessToken", "token");
  profile = { uid: "u1", companyCode: "ACME", role: "admin", branchId: "" };
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("recovers the active branch after a proxy failure without exposing an error or needing reload", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response("Bad Gateway", { status: 502 })).mockResolvedValueOnce(success("b1"));
  vi.stubGlobal("fetch", fetchMock);
  render(<BranchProvider><Probe /></BranchProvider>);
  await act(async () => { await vi.advanceTimersByTimeAsync(499); });
  expect(screen.getByText("loading")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(screen.getByText("b1")).toBeTruthy();
  expect(localStorage.getItem("igen.activeBranch.ACME")).toBe("b1");
});

it("cancels the old company's pending retry before selecting a branch for a different company", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(success("other-branch"));
  vi.stubGlobal("fetch", fetchMock);
  const view = render(<BranchProvider><Probe /></BranchProvider>);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  profile = { ...profile, companyCode: "OTHER" };
  view.rerender(<BranchProvider><Probe /></BranchProvider>);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByText("other-branch")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem("igen.activeBranch.ACME")).toBeNull();
  expect(localStorage.getItem("igen.activeBranch.OTHER")).toBe("other-branch");
});

it("shows a denied branch read immediately without automatic retries", async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Bạn không có quyền xem chi nhánh." } }), { status: 403 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<BranchProvider><Probe /></BranchProvider>);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByText("Bạn không có quyền xem chi nhánh.")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem("igen.activeBranch.ACME")).toBeNull();
});
