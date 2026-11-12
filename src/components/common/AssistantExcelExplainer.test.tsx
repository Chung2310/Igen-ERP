// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { assistantService } from "../../services/assistantService";
import { AssistantTools } from "./AssistantTools";

vi.mock("../../services/assistantService", () => ({ assistantService: { turn: vi.fn() } }));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("explains an Excel formula through the chat QA model and keeps context for a follow-up", async () => {
  const user = userEvent.setup();
  const turn = vi.mocked(assistantService.turn);
  turn.mockResolvedValueOnce({ status: "completed", reply: "SUMIF cộng các giá trị đáp ứng điều kiện." });
  turn.mockResolvedValueOnce({ status: "completed", reply: "Với cột B, hãy chọn vùng cần cộng ở đối số thứ ba." });
  render(<AssistantTools branchId="main-branch" />);

  await user.click(screen.getByText("Giải thích công thức Excel"));
  await user.type(screen.getByRole("textbox", { name: /Công thức cần giải thích/ }), "=SUMIF(A:A,\"Đã bán\",B:B)");
  await user.type(screen.getByRole("textbox", { name: "Mô tả dữ liệu" }), "Cột A là trạng thái, cột B là doanh thu");
  await user.click(screen.getByRole("radio", { name: "Chuyên sâu" }));
  await user.click(screen.getByRole("button", { name: "Giải thích" }));

  await waitFor(() => expect(screen.getByText("SUMIF cộng các giá trị đáp ứng điều kiện.")).toBeTruthy());
  expect(turn).toHaveBeenCalledWith(expect.objectContaining({
    mode: "qa",
    text: expect.stringContaining("=SUMIF(A:A,\"Đã bán\",B:B)"),
  }), expect.any(AbortSignal), "main-branch");
  expect(turn.mock.calls[0][0].text).toContain("Cột A là trạng thái, cột B là doanh thu");
  expect(turn.mock.calls[0][0].text).toContain("Chuyên sâu");

  await user.type(screen.getByRole("textbox", { name: "Hỏi thêm về công thức này" }), "Đối số thứ ba là gì?");
  await user.click(screen.getByRole("button", { name: "Gửi câu hỏi tiếp theo" }));
  await waitFor(() => expect(screen.getByText("Với cột B, hãy chọn vùng cần cộng ở đối số thứ ba.")).toBeTruthy());
  expect(turn.mock.calls[1][0]).toMatchObject({ mode: "qa", text: "Đối số thứ ba là gì?", conversationId: turn.mock.calls[0][0].conversationId });
  expect(turn.mock.calls[1][0].requestId).not.toBe(turn.mock.calls[0][0].requestId);
}, 15000);

it("keeps the entered formula and shows an API error so the user can retry", async () => {
  const user = userEvent.setup();
  vi.mocked(assistantService.turn).mockRejectedValueOnce(new Error("Dịch vụ AI tạm thời không khả dụng."));
  render(<AssistantTools />);

  await user.click(screen.getByText("Giải thích công thức Excel"));
  const formula = screen.getByRole("textbox", { name: /Công thức cần giải thích/ }) as HTMLTextAreaElement;
  await user.type(formula, "=SUM(A1:A5)");
  await user.click(screen.getByRole("button", { name: "Giải thích" }));

  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Dịch vụ AI tạm thời không khả dụng.");
  expect(formula.value).toBe("=SUM(A1:A5)");
  expect(screen.getByRole("button", { name: "Giải thích" }).hasAttribute("disabled")).toBe(false);
});
