// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { AssistantStudioHistoryAction, AssistantStudioHistoryDrawer } from "./AssistantStudioHistoryDrawer";

afterEach(cleanup);

it("slides as a dialog and restores focus to its corner action on Escape", async () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return <>
      <AssistantStudioHistoryAction open={open} onClick={() => setOpen(true)} />
      <AssistantStudioHistoryDrawer open={open} title="Lịch sử ảnh" onClose={() => setOpen(false)}>
        <button type="button">Mở ảnh</button>
      </AssistantStudioHistoryDrawer>
    </>;
  }

  render(<Harness />);
  const action = screen.getByRole("button", { name: "Lịch sử" });
  action.focus();
  fireEvent.click(action);

  const dialog = screen.getByRole("dialog", { name: "Lịch sử ảnh" });
  const historyIcon = dialog.querySelector("header span");
  expect(historyIcon?.className).toContain("text-on-surface-variant");
  expect(historyIcon?.className).not.toContain("bg-amber");
  await waitFor(() => expect(dialog.className).toContain("translate-x-0"));
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Đóng lịch sử" }));
  fireEvent.keyDown(dialog, { key: "Escape" });

  await waitFor(() => expect(dialog.className).toContain("translate-x-full"));
  expect(screen.getByRole("dialog", { name: "Lịch sử ảnh" })).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Lịch sử ảnh" })).toBeNull());
  expect(document.activeElement).toBe(action);
});
