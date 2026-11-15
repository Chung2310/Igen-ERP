// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
vi.mock("./AssistantMoveToProjectMenu", () => ({ AssistantMoveToProjectMenu: () => null }));

const baseProps = {
  branchId: "branch-1",
  onOpenConversation: vi.fn(),
  onOpenStudio: vi.fn(),
  onOpenHistory: vi.fn(),
  onHistoryScrollDown: vi.fn(),
  projects: [],
  assignedConversationIds: new Set<string>(),
  onMoveConversation: vi.fn(),
  onOpenProjects: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(assistantService.conversations).mockResolvedValue({
    items: [{ conversationId: "recent-1", mode: "qa", title: "Tra cứu gần đây", preview: "Nội dung gần đây", messageCount: 2, updatedAt: "2026-11-14T10:00:00.000Z" }],
    nextCursor: null,
  });
});

afterEach(cleanup);

it("opens the history dropdown by default and searches conversation content", async () => {
  vi.mocked(assistantService.conversations).mockImplementation(async (_cursor, _signal, _branchId, search) => ({
    items: search
      ? [{ conversationId: "search-1", mode: "qa", title: "Tra cứu học phí", preview: "Mức học phí năm nay", messageCount: 4, updatedAt: "2026-11-13T10:00:00.000Z" }]
      : [{ conversationId: "recent-1", mode: "qa", title: "Tra cứu gần đây", preview: "Nội dung gần đây", messageCount: 2, updatedAt: "2026-11-14T10:00:00.000Z" }],
    nextCursor: null,
  }));
  render(<AssistantQuickHistoryDropdown {...baseProps} />);

  expect(screen.getByRole("button", { name: "Xem nhanh lịch sử" }).getAttribute("aria-expanded")).toBe("true");
  const historyRegion = screen.getByRole("region", { name: "Lịch sử gần nhất" });
  const searchbox = screen.getByRole("searchbox", { name: "Tìm trong lịch sử trò chuyện" });
  const historyScrollArea = historyRegion.querySelector(".overflow-y-auto");
  expect(historyRegion).not.toBeNull();
  expect(historyScrollArea?.contains(searchbox)).toBe(false);
  expect(await screen.findByRole("button", { name: "Tra cứu gần đây" })).not.toBeNull();
  fireEvent.wheel(historyScrollArea!, { deltaY: 100 });
  expect(baseProps.onHistoryScrollDown).toHaveBeenCalledOnce();

  fireEvent.change(searchbox, { target: { value: "học phí" } });
  await waitFor(() => expect(assistantService.conversations).toHaveBeenLastCalledWith(undefined, expect.anything(), "branch-1", "học phí"));
  expect(await screen.findByRole("button", { name: "Tra cứu học phí" })).not.toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Mở toàn bộ lịch sử" }));
  expect(baseProps.onOpenHistory).toHaveBeenCalledWith("học phí");
});
