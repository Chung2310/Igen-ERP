// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import PublicRepairFeedbackPage from "./PublicRepairFeedbackPage";

afterEach(() => {
  vi.restoreAllMocks();
});

test("loads a repair token and submits the selected rating without authentication", async () => {
  window.history.replaceState(null, "", "/repair/feedback/token-123");
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { ticketCode: "SC-001", deviceName: "iPhone 13", technicianName: "Nguyễn An" } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { id: "feedback-1" } }) });
  vi.stubGlobal("fetch", fetchMock);

  render(<PublicRepairFeedbackPage />);

  expect(await screen.findByText("SC-001")).not.toBeNull();
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "5 sao" }));
  await user.click(screen.getByRole("button", { name: "Gửi đánh giá" }));

  await waitFor(() => expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    "/api/v1/repair/feedback/token-123",
    expect.objectContaining({ method: "POST", body: JSON.stringify({ rating: 5, comment: "" }) }),
  ));
  expect(await screen.findByText("Cảm ơn bạn đã đánh giá!")).not.toBeNull();
});
