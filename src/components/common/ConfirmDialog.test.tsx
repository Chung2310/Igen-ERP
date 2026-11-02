// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

afterEach(cleanup);

describe("ConfirmDialog focus", () => {
  it("keeps keyboard focus inside and restores the trigger when closed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<><button type="button">Mở hộp thoại</button><ConfirmDialog isOpen={false} title="Xác nhận" description="Thử nghiệm" onClose={onClose} onConfirm={() => undefined} /></>);
    const trigger = screen.getByRole("button", { name: "Mở hộp thoại" });
    trigger.focus();
    rerender(<><button type="button">Mở hộp thoại</button><ConfirmDialog isOpen title="Xác nhận" description="Thử nghiệm" onClose={onClose} onConfirm={() => undefined} /></>);
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    rerender(<><button type="button">Mở hộp thoại</button><ConfirmDialog isOpen={false} title="Xác nhận" description="Thử nghiệm" onClose={onClose} onConfirm={() => undefined} /></>);
    expect(document.activeElement).toBe(trigger);
  });
});
