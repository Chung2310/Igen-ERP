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

it("shows a positive thank-you popup for a high rating", async () => {
  vi.mocked(assistantService.submitAnswerFeedback).mockResolvedValue({ rating: 4, comment: "Rõ ràng", submittedAt: "2026-11-28T04:00:00.000Z" });
  render(<AssistantAnswerFeedback conversationId="conversation-1" answerAt="2026-11-28T04:00:00.000Z" branchId="branch-1" />);

  fireEvent.click(screen.getByRole("button", { name: "Đánh giá 4 trên 5 sao" }));
  expect(screen.getByRole("dialog", { name: "Gửi đánh giá câu trả lời" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Lý do đánh giá (bắt buộc)"), { target: { value: "Rõ ràng" } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi đánh giá" }));

  await waitFor(() => expect(assistantService.submitAnswerFeedback).toHaveBeenCalledWith(
    "conversation-1", "2026-11-28T04:00:00.000Z", 4, "Rõ ràng", "branch-1",
  ));
  expect(await screen.findByRole("dialog", { name: "Cảm ơn đánh giá tích cực" })).toBeTruthy();
  expect(screen.getByText("Cảm ơn bạn đã đánh giá tích cực. Phản hồi của bạn giúp chúng tôi tiếp tục cải thiện trợ lý ERP.")).toBeTruthy();
  expect(screen.getByRole("status")).toHaveProperty("textContent", "Đã lưu đánh giá 4/5 sao.");
});

it("shows a review-and-improve message for a low rating", async () => {
  vi.mocked(assistantService.submitAnswerFeedback).mockResolvedValue({ rating: 2, comment: "Thiếu thông tin", submittedAt: "2026-11-28T04:00:00.000Z" });
  render(<AssistantAnswerFeedback conversationId="conversation-1" answerAt="2026-11-28T04:00:00.000Z" branchId="branch-1" />);

  fireEvent.click(screen.getByRole("button", { name: "Đánh giá 2 trên 5 sao" }));
  fireEvent.change(screen.getByLabelText("Lý do đánh giá (bắt buộc)"), { target: { value: "Thiếu thông tin" } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi đánh giá" }));

  expect(await screen.findByRole("dialog", { name: "Cảm ơn góp ý" })).toBeTruthy();
  expect(screen.getByText("Cảm ơn bạn đã góp ý. Chúng tôi sẽ kiểm tra đánh giá và xử lý để cải thiện câu trả lời.")).toBeTruthy();
});

it("shows a save error next to the feedback control", async () => {
  vi.mocked(assistantService.submitAnswerFeedback).mockRejectedValue(new Error("Không thể lưu đánh giá."));
  render(<AssistantAnswerFeedback conversationId="conversation-1" answerAt="2026-11-28T04:00:00.000Z" branchId="" />);

  fireEvent.click(screen.getByRole("button", { name: "Đánh giá 2 trên 5 sao" }));
  fireEvent.change(screen.getByLabelText("Lý do đánh giá (bắt buộc)"), { target: { value: "Chưa đúng" } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi đánh giá" }));

  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Không thể lưu đánh giá.");
});
