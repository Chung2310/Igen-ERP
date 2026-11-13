// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistantMessageActions } from "./AssistantMessageActions";

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const originalHide = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "hidePopover");

afterEach(() => {
  cleanup();
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
  if (originalHide) Object.defineProperty(HTMLElement.prototype, "hidePopover", originalHide);
  else Reflect.deleteProperty(HTMLElement.prototype, "hidePopover");
});

function setup(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const hide = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "hidePopover", { configurable: true, value: hide });
  render(<AssistantMessageActions content={"Kết quả\n\n| Tên | Giá trị |\n| --- | --- |\n| An | 12 |\n\nBạn muốn bổ sung không?"} />);
  fireEvent.click(screen.getByRole("button", { name: "Tùy chọn câu trả lời AI" }));
  return hide;
}

it("connects the options button to its popover and copies the complete reply", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const hide = setup(writeText);
  const trigger = screen.getByRole("button", { name: "Tùy chọn câu trả lời AI" });
  expect(document.getElementById(trigger.getAttribute("popovertarget")!)?.getAttribute("popover")).toBe("auto");
  // jsdom does not implement the native popover opening behavior.
  fireEvent.click(screen.getByRole("button", { name: "Copy tin nhắn", hidden: true }));
  await waitFor(() => expect(hide).toHaveBeenCalledOnce());
  expect(screen.queryByText("Đã sao chép tin nhắn.")).toBeNull();
  expect(writeText).toHaveBeenCalledWith("Kết quả\n\n| Tên | Giá trị |\n| --- | --- |\n| An | 12 |\n\nBạn muốn bổ sung không?");
  expect(hide).toHaveBeenCalledOnce();
});

it("reports denied clipboard access next to the action", async () => {
  setup(vi.fn().mockRejectedValue(new Error("Permission denied")));
  fireEvent.click(screen.getByRole("button", { name: "Copy tin nhắn", hidden: true }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Không thể sao chép. Vui lòng thử lại.");
  expect(screen.queryByText("Đã sao chép tin nhắn.")).toBeNull();
});
