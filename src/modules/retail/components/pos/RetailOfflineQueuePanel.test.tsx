// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RetailOfflineQueuePanel from "./RetailOfflineQueuePanel";
afterEach(cleanup);
const item: any = { id: "q1", idempotencyKey: "key", status: "pending", attempts: 0, createdAt: "2026-08-12T00:00:00Z", lastError: undefined };
describe("RetailOfflineQueuePanel", () => {
  it("keeps unresolved requests while exposing retry, reconcile and revoke actions", () => {
    const retry = vi.fn(), remove = vi.fn(), reconcile = vi.fn(), revoke = vi.fn();
    render(<RetailOfflineQueuePanel items={[item, { ...item, id: "q2", status: "failed", lastError: "Sai giá" }]} onRetry={retry} onRemove={remove} onReconcile={reconcile} onRevoke={revoke} />);
    expect(screen.getByText("Chờ đồng bộ")).toBeTruthy();
    expect(screen.getByText("Sai giá")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Xóa q1" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xóa q2" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại q2" }));
    fireEvent.click(screen.getByRole("button", { name: "Đối chiếu q1" }));
    fireEvent.click(screen.getByRole("button", { name: "Thu hồi q1" }));
    expect(retry).toHaveBeenCalledWith("q2");
    expect(reconcile).toHaveBeenCalledWith("q1");
    expect(revoke).toHaveBeenCalledWith("q1");
    expect(remove).not.toHaveBeenCalled();
  });

  it("allows cleanup only after confirmation has been recorded", () => {
    const remove = vi.fn();
    render(<RetailOfflineQueuePanel items={[{ ...item, status: "synced" }]} onRetry={vi.fn()} onRemove={remove} />);
    fireEvent.click(screen.getByRole("button", { name: "Xóa q1" }));
    expect(remove).toHaveBeenCalledWith("q1");
    expect(screen.queryByRole("button", { name: "Thử lại q1" })).toBeNull();
  });
});
