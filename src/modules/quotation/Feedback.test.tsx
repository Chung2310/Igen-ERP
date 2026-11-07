// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useConfirmation } from "./Feedback";

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
