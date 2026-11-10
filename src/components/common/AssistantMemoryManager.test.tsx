// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ memories: vi.fn(), createMemory: vi.fn(), updateMemory: vi.fn(), deleteMemory: vi.fn(), sessionMemory: vi.fn(), saveSessionMemory: vi.fn(), clearSessionMemory: vi.fn() }));
vi.mock("../../services/assistantService", () => ({ assistantService: mocks }));
import { AssistantMemoryManager } from "./AssistantMemoryManager";

afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("adds account memories through the labeled form", async () => {
  mocks.memories.mockResolvedValueOnce([]);
  mocks.createMemory.mockResolvedValueOnce({ item: { id: "memory-1", content: "Tôi thích câu trả lời ngắn.", createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z" }, created: true });
  render(<AssistantMemoryManager enabled />);
  await screen.findByText(/Chưa có ghi nhớ/);
  fireEvent.change(screen.getByLabelText("Thông tin muốn ghi nhớ"), { target: { value: "Tôi thích câu trả lời ngắn." } });
  fireEvent.click(screen.getByText("Thêm ghi nhớ"));
  await screen.findByText("Đã thêm ghi nhớ.");
  expect(mocks.createMemory).toHaveBeenCalledWith("Tôi thích câu trả lời ngắn.");
  expect(screen.getByText("Tôi thích câu trả lời ngắn.")).toBeTruthy();
});

it("edits and confirms deletion of a memory", async () => {
  mocks.memories.mockResolvedValueOnce([{ id: "memory-1", content: "Tôi thích ví dụ.", createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z" }]);
  mocks.updateMemory.mockResolvedValueOnce({ id: "memory-1", content: "Tôi thích ví dụ ngắn.", createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-02T00:00:00.000Z" });
  mocks.deleteMemory.mockResolvedValueOnce({ deleted: true });
  render(<AssistantMemoryManager enabled={false} />);
  await screen.findByText("Tôi thích ví dụ.");
  fireEvent.click(screen.getByText("Sửa"));
  fireEvent.change(screen.getByLabelText("Thông tin muốn ghi nhớ"), { target: { value: "Tôi thích ví dụ ngắn." } });
  fireEvent.click(screen.getByText("Lưu thay đổi"));
  await screen.findByText("Đã cập nhật ghi nhớ.");
  expect(mocks.updateMemory).toHaveBeenCalledWith("memory-1", "Tôi thích ví dụ ngắn.");
  fireEvent.click(screen.getByText("Xóa"));
  expect(screen.getByRole("dialog", { name: "Xóa ghi nhớ này?" })).toBeTruthy();
  fireEvent.click(screen.getByText("Xóa ghi nhớ"));
  await screen.findByText("Đã xóa ghi nhớ.");
  expect(mocks.deleteMemory).toHaveBeenCalledWith("memory-1");
});

it("shows the automatic-save source in the memory manager, away from chat", async () => {
  mocks.memories.mockResolvedValueOnce([{ id: "memory-auto", content: "Tôi thích câu trả lời ngắn gọn.", source: "automatic", createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z", lastUsedAt: "2026-11-03T00:00:00.000Z" }]);
  render(<AssistantMemoryManager enabled />);
  await screen.findByText("Tôi thích câu trả lời ngắn gọn.");
  expect(screen.getByText("Tự lưu")).toBeTruthy();
  expect(screen.getByText(/Dùng gần nhất/)).toBeTruthy();
});

it("lets the user review, edit, and clear only this conversation's summary", async () => {
  mocks.memories.mockResolvedValueOnce([]);
  mocks.sessionMemory.mockResolvedValueOnce({ summary: "Mục tiêu là hoàn tất kế hoạch ra mắt.", summaryMessageCount: 42, version: 2, messageCount: 42 });
  mocks.saveSessionMemory.mockResolvedValueOnce({ summary: "Mục tiêu là hoàn tất kế hoạch ra mắt trong tháng này.", version: 3, messageCount: 42, summaryMessageCount: 42 });
  mocks.clearSessionMemory.mockResolvedValueOnce({ summary: "", version: 4, messageCount: 42, summaryMessageCount: 42 });
  render(<AssistantMemoryManager enabled conversationId="conversation-1" branchId="branch-1" />);

  const editor = await screen.findByLabelText("Tóm tắt riêng của phiên này") as HTMLTextAreaElement;
  expect(editor.value).toBe("Mục tiêu là hoàn tất kế hoạch ra mắt.");
  fireEvent.change(editor, { target: { value: "Mục tiêu là hoàn tất kế hoạch ra mắt trong tháng này." } });
  fireEvent.click(screen.getByText("Lưu ngữ cảnh phiên"));
  await screen.findByText("Đã lưu ngữ cảnh cho phiên chat này.");
  expect(mocks.saveSessionMemory).toHaveBeenCalledWith("conversation-1", "Mục tiêu là hoàn tất kế hoạch ra mắt trong tháng này.", 2, "branch-1");

  fireEvent.click(screen.getByText("Xóa ngữ cảnh phiên"));
  const dialog = screen.getByRole("dialog", { name: "Xóa ngữ cảnh tóm tắt của phiên?" });
  expect(dialog).toBeTruthy();
  fireEvent.click(within(dialog).getByText("Xóa ngữ cảnh phiên"));
  await screen.findByText("Đã xóa ngữ cảnh tóm tắt. Lịch sử tin nhắn của phiên vẫn được giữ.");
  expect(mocks.clearSessionMemory).toHaveBeenCalledWith("conversation-1", "branch-1");
});
