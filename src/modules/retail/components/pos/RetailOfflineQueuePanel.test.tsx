// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RetailOfflineQueuePanel from "./RetailOfflineQueuePanel";
afterEach(cleanup);
const item: any = { id: "q1", idempotencyKey: "key", status: "pending", attempts: 0, createdAt: "2026-08-12T00:00:00Z", lastError: undefined };
describe("RetailOfflineQueuePanel", () => {
  it("labels pending orders and exposes scoped retry/remove actions", () => { const retry = vi.fn(), remove = vi.fn(); render(<RetailOfflineQueuePanel items={[item, { ...item, id: "q2", status: "failed", lastError: "Sai giá" }]} onRetry={retry} onRemove={remove} />); expect(screen.getByText("Chờ đồng bộ")).toBeTruthy(); expect(screen.getByText("Sai giá")).toBeTruthy(); fireEvent.click(screen.getByRole("button", { name: "Thử lại q2" })); fireEvent.click(screen.getByRole("button", { name: "Xóa q1" })); expect(retry).toHaveBeenCalledWith("q2"); expect(remove).toHaveBeenCalledWith("q1"); });
});
