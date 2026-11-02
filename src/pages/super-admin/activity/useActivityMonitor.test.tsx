// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activityMonitorService, type MonitorSnapshot } from "../../../services/activityMonitorService";
import { useActivityMonitor, ACTIVITY_REFRESH_MS } from "./useActivityMonitor";

vi.mock("../../../services/activityMonitorService", () => ({ activityMonitorService: { list: vi.fn() } }));
const snapshot = (total: number): MonitorSnapshot => ({ data: [], total, page: 1, limit: 30, summary: { failures: 0, companies: 1, activeUsers: 1 }, generatedAt: "2026-10-23T10:00:00Z", retentionDays: 90 });
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); vi.mocked(activityMonitorService.list).mockResolvedValue(snapshot(10)); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("activity monitoring updates", () => {
  it("freezes the list while paused, counts all new events and resumes with the latest snapshot", async () => {
    const { result } = renderHook(() => useActivityMonitor({ companyCode: "ACME", page: 1 }));
    await act(async () => {});
    expect(result.current.snapshot?.total).toBe(10);
    act(() => result.current.togglePaused());
    vi.mocked(activityMonitorService.list).mockResolvedValue(snapshot(85));
    await act(async () => { await vi.advanceTimersByTimeAsync(ACTIVITY_REFRESH_MS); });
    expect(result.current.snapshot?.total).toBe(10);
    expect(result.current.pendingCount).toBe(75);
    act(() => result.current.togglePaused());
    expect(result.current.snapshot?.total).toBe(85);
    expect(result.current.pendingCount).toBe(0);
  });
  it("aborts old requests and resets the frozen snapshot on tenant changes", async () => {
    const { result, rerender, unmount } = renderHook(({ companyCode }) => useActivityMonitor({ companyCode }), { initialProps: { companyCode: "ACME" } });
    await act(async () => {});
    const oldSignal = vi.mocked(activityMonitorService.list).mock.calls[0][1];
    act(() => result.current.togglePaused());
    vi.mocked(activityMonitorService.list).mockResolvedValue(snapshot(2));
    rerender({ companyCode: "OTHER" });
    await act(async () => {});
    expect(oldSignal?.aborted).toBe(true);
    expect(result.current.paused).toBe(false);
    expect(result.current.snapshot?.total).toBe(2);
    const lastSignal = vi.mocked(activityMonitorService.list).mock.calls.at(-1)?.[1];
    unmount();
    expect(lastSignal?.aborted).toBe(true);
  });
  it("keeps last successful data after a network failure and recovers", async () => {
    const { result } = renderHook(() => useActivityMonitor({ page: 1 }));
    await act(async () => {});
    vi.mocked(activityMonitorService.list).mockRejectedValueOnce(new Error("Mất kết nối"));
    await act(async () => { await vi.advanceTimersByTimeAsync(ACTIVITY_REFRESH_MS); });
    expect(result.current.snapshot?.total).toBe(10);
    expect(result.current.error).toBe("Mất kết nối");
    await act(async () => { await vi.advanceTimersByTimeAsync(ACTIVITY_REFRESH_MS); });
    expect(result.current.error).toBe("");
  });
  it("does not move historical pages or poll them in the background", async () => {
    renderHook(() => useActivityMonitor({ page: 2 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(ACTIVITY_REFRESH_MS * 3); });
    expect(activityMonitorService.list).toHaveBeenCalledTimes(1);
  });
  it("ignores late responses from a previous tenant", async () => {
    let resolveOld!: (value: MonitorSnapshot) => void;
    vi.mocked(activityMonitorService.list).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
    const { result, rerender } = renderHook(({ companyCode }) => useActivityMonitor({ companyCode }), { initialProps: { companyCode: "ACME" } });
    rerender({ companyCode: "OTHER" });
    await act(async () => {});
    await act(async () => { resolveOld(snapshot(999)); });
    expect(result.current.snapshot?.total).toBe(10);
  });
});
