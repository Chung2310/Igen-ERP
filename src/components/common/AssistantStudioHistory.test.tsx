// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AssistantStudioHistory } from "./AssistantStudioHistory";

const { listSlides } = vi.hoisted(() => ({ listSlides: vi.fn().mockResolvedValue([]) }));

vi.mock("../../services/assistantService", () => ({ assistantService: {
  studioCharts: vi.fn().mockResolvedValue([]),
  studioSlideDecks: listSlides,
  studioTranscripts: vi.fn().mockResolvedValue([]),
} }));
vi.mock("../../services/assistantStudioHistory", () => ({
  combineAssistantStudioHistory: () => [],
  listAssistantStudioCreationHistory: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../services/assistantSpeechHistory", () => ({
  getAssistantSpeechHistoryUserId: () => "test-user",
  listAssistantSpeechHistory: vi.fn().mockResolvedValue([]),
}));

afterEach(cleanup);

it("renders Studio history without an empty refresh row", async () => {
  render(<AssistantStudioHistory onOpen={vi.fn()} onStart={vi.fn()} />);

  expect(await screen.findByText("Chưa có hoạt động Studio")).not.toBeNull();
  expect(listSlides).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Tải lại lịch sử AI Studio" })).toBeNull();
});
