// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { estimateGeneratedFileProgress, TaskProgress, useConfirmation } from "./Feedback";

function Fixture() {
  const { confirm, dialog } = useConfirmation();
  return <><button onClick={() => void confirm({ title: "Tạo lại dự toán?", message: "Dùng câu trả lời", confirmLabel: "Tạo lại" })}>Mở xác nhận</button>{dialog}</>;
}
describe("quotation confirmation", () => {
  beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.open = true; }; HTMLDialogElement.prototype.close = function () { this.open = false; }; });
  afterEach(cleanup);
  it("uses a native modal dialog and restores the trigger on cancel", async () => {
    render(<Fixture />); const trigger = screen.getByRole("button", { name: "Mở xác nhận" }); trigger.focus(); fireEvent.click(trigger);
    expect((await screen.findByRole("alertdialog")).tagName).toBe("DIALOG");
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull()); expect(document.activeElement).toBe(trigger);
  });
  it("closes on the native Escape/cancel event", async () => {
    render(<Fixture />); fireEvent.click(screen.getByRole("button", { name: "Mở xác nhận" }));
    fireEvent(await screen.findByRole("alertdialog"), new Event("cancel", { bubbles: true, cancelable: true }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});

describe("estimated generated-file progress", () => {
  it("shows queued work and advances running estimates without claiming completion", () => {
    expect(estimateGeneratedFileProgress("queued", undefined, 50_000)).toBe(8);
    expect(estimateGeneratedFileProgress("running", 10_000, 25_000)).toBe(23);
    expect(estimateGeneratedFileProgress("running", 0, 10 * 60_000)).toBe(90);
    expect(estimateGeneratedFileProgress("completed", undefined, 50_000)).toBe(100);
  });

  it("labels displayed estimates as approximate for assistive technology", () => {
    const startedAt = Date.now();
    render(<TaskProgress label="Đang tạo file báo giá" estimated status="running" startedAt={startedAt} />);
    expect(screen.getByText("~20%")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("Ước tính khoảng 20%");
  });
});
