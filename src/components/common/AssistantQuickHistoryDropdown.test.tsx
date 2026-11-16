// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { assistantService } from "../../services/assistantService";
import { AssistantQuickHistoryDropdown } from "./AssistantQuickHistoryDropdown";

vi.mock("../../services/assistantService", () => ({ assistantService: {
  conversations: vi.fn(),
  studioCharts: vi.fn(async () => []),
  studioSlideDecks: vi.fn(async () => []),
  studioTranscripts: vi.fn(async () => []),
} }));
vi.mock("../../services/assistantStudioHistory", () => ({
  combineAssistantStudioHistory: () => [],
  listAssistantStudioCreationHistory: async () => [],
}));
vi.mock("../../services/assistantSpeechHistory", () => ({
  getAssistantSpeechHistoryUserId: () => "test-user",
  listAssistantSpeechHistory: async () => [],
}));
const baseProps = {
  branchId: "branch-1",
  onOpenConversation: vi.fn(),
  onOpenStudio: vi.fn(),
  onOpenHistory: vi.fn(),
  projects: [],
  onMoveConversation: vi.fn(),
  onOpenProjects: vi.fn(),
  onToggleFavorite: vi.fn(),
  onRenameConversation: vi.fn(),
  onDeleteConversation: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(assistantService.conversations).mockResolvedValue({
    items: [{ conversationId: "recent-1", mode: "qa", title: "Tra cứu gần đây", preview: "Nội dung gần đây", messageCount: 2, updatedAt: "2026-11-14T10:00:00.000Z" }],
    nextCursor: null,
  });
});

afterEach(cleanup);

it("opens recent history without a search field", async () => {
  render(<AssistantQuickHistoryDropdown {...baseProps} />);

  const historyToggle = screen.getByRole("button", { name: "Xem nhanh lịch sử" });
  expect(historyToggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(historyToggle);
  expect(historyToggle.getAttribute("aria-expanded")).toBe("true");
  const historyRegion = screen.getByRole("region", { name: "Lịch sử gần nhất" });
  expect(historyRegion).not.toBeNull();
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(await screen.findByRole("button", { name: "Tra cứu gần đây" })).not.toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Tùy chọn cuộc trò chuyện Tra cứu gần đây" }));
  expect(screen.getByRole("button", { name: "Yêu thích" })).not.toBeNull();
  expect(screen.getByRole("button", { name: "Sửa tên" })).not.toBeNull();
  expect(screen.getByText("Di chuyển sang dự án")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Xóa" })).not.toBeNull();
  expect(screen.queryByText("Chia sẻ")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Yêu thích" }));
  expect(baseProps.onToggleFavorite).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "recent-1" }), true);

  fireEvent.click(screen.getByRole("button", { name: "Mở toàn bộ lịch sử" }));
  expect(baseProps.onOpenHistory).toHaveBeenCalledOnce();
});
