// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { assistantService } from "../../services/assistantService";
import { AssistantAnswerFeedback } from "./AssistantAnswerFeedback";

vi.mock("../../services/assistantService", () => ({ assistantService: { submitAnswerFeedback: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("saves a star rating and optional comment for the assistant answer", async () => {
  vi.mocked(assistantService.submitAnswerFeedback).mockResolvedValue({ rating: 4, comment: "Rõ ràng", submittedAt: "2026-11-28T04:00:00.000Z" });
  render(<AssistantAnswerFeedback conversationId="conversation-1" answerAt="2026-11-28T04:00:00.000Z" branchId="branch-1" />);

  fireEvent.click(screen.getByRole("button", { name: "Đánh giá 4 trên 5 sao" }));
  expect(screen.getByRole("dialog", { name: "Gửi đánh giá câu trả lời" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Lý do đánh giá (bắt buộc)"), { target: { value: "Rõ ràng" } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi đánh giá" }));

  await waitFor(() => expect(assistantService.submitAnswerFeedback).toHaveBeenCalledWith(
    "conversation-1", "2026-11-28T04:00:00.000Z", 4, "Rõ ràng", "branch-1",
  ));
  expect(await screen.findByRole("status")).toHaveProperty("textContent", "Đã lưu đánh giá 4/5 sao.");
});

it("shows a save error next to the feedback control", async () => {
  vi.mocked(assistantService.submitAnswerFeedback).mockRejectedValue(new Error("Không thể lưu đánh giá."));
  render(<AssistantAnswerFeedback conversationId="conversation-1" answerAt="2026-11-28T04:00:00.000Z" branchId="" />);

  fireEvent.click(screen.getByRole("button", { name: "Đánh giá 2 trên 5 sao" }));
  fireEvent.change(screen.getByLabelText("Lý do đánh giá (bắt buộc)"), { target: { value: "Chưa đúng" } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi đánh giá" }));

  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Không thể lưu đánh giá.");
});
