// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AiProgressPopup from "./AiProgressPopup";
import { aiProgress } from "./ai-progress";

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } },
    close: { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } },
  });
});
afterEach(() => { cleanup(); aiProgress.reset(); vi.restoreAllMocks(); vi.useRealTimers(); });

it("announces estimated progress and returns focus after success", async () => {
  render(<><button>Tạo file</button><AiProgressPopup /></>);
  const trigger = screen.getByRole("button", { name: "Tạo file" }); trigger.focus();
  let task!: ReturnType<typeof aiProgress.begin>;
  act(() => { task = aiProgress.begin({ label: "Đang tạo file hợp đồng" }); });
  expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toContain("ước tính");
  act(() => { task.complete(); });
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  await act(async () => { await vi.advanceTimersByTimeAsync(800); });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it("keeps errors visible until dismissed and hides provider details", () => {
  render(<AiProgressPopup />);
  act(() => { aiProgress.begin({ label: "Đang tạo file" }).fail(new Error("OpenRouter HTTP 402: insufficient credits")); });
  expect(screen.getByRole("alert").textContent).not.toMatch(/OpenRouter|402|credits/);
  expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeLessThan(100);
  fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
