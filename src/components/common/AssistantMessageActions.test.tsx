// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistantMessageActions, AssistantUserMessageActions } from "./AssistantMessageActions";

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const originalShare = Object.getOwnPropertyDescriptor(navigator, "share");

afterEach(() => {
  cleanup();
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
  if (originalShare) Object.defineProperty(navigator, "share", originalShare);
  else Reflect.deleteProperty(navigator, "share");
});

function setup(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<AssistantMessageActions content={"Kết quả\n\n| Tên | Giá trị |\n| --- | --- |\n| An | 12 |\n\nBạn muốn bổ sung không?"} />);
}

it("copies the complete AI reply", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  setup(writeText);
  fireEvent.click(screen.getByRole("button", { name: "Sao chép câu trả lời" }));
  expect((await screen.findByRole("button", { name: "Đã sao chép câu trả lời" })).hasAttribute("title")).toBe(false);
  expect(screen.getByRole("button", { name: "Đã sao chép câu trả lời" }).querySelector(".lucide-check")).not.toBeNull();
  expect(screen.getByRole("status")).toHaveProperty("className", "sr-only");
  expect(writeText).toHaveBeenCalledWith("Kết quả\n\n| Tên | Giá trị |\n| --- | --- |\n| An | 12 |\n\nBạn muốn bổ sung không?");
});

it("reports denied clipboard access next to the action", async () => {
  setup(vi.fn().mockRejectedValue(new Error("Permission denied")));
  fireEvent.click(screen.getByRole("button", { name: "Sao chép câu trả lời" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Không thể sao chép câu trả lời. Vui lòng thử lại.");
});

it("shares the complete reply using the native share sheet", async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "share", { configurable: true, value: share });
  setup(vi.fn());

  fireEvent.click(screen.getByRole("button", { name: "Chia sẻ câu trả lời" }));

  expect(await screen.findByRole("status")).toHaveProperty("textContent", "Đã chia sẻ câu trả lời.");
  expect(share).toHaveBeenCalledWith({ text: "Kết quả\n\n| Tên | Giá trị |\n| --- | --- |\n| An | 12 |\n\nBạn muốn bổ sung không?" });
});

it("copies the reply as a sharing fallback when native sharing is unavailable", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  setup(writeText);

  fireEvent.click(screen.getByRole("button", { name: "Chia sẻ câu trả lời" }));

  expect((await screen.findByRole("button", { name: "Đã sao chép câu trả lời" })).querySelector(".lucide-check")).not.toBeNull();
  expect(screen.getByRole("status")).toHaveProperty("className", "sr-only");
  expect(writeText).toHaveBeenCalledWith("Kết quả\n\n| Tên | Giá trị |\n| --- | --- |\n| An | 12 |\n\nBạn muốn bổ sung không?");
});

it("shows a check on the user message after copying without visible success text", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<AssistantUserMessageActions content="Yêu cầu của tôi" onEdit={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Sao chép yêu cầu" }));

  expect((await screen.findByRole("button", { name: "Đã sao chép yêu cầu" })).querySelector(".lucide-check")).not.toBeNull();
  expect(screen.getByRole("status")).toHaveProperty("className", "sr-only");
  expect(writeText).toHaveBeenCalledWith("Yêu cầu của tôi");
});
