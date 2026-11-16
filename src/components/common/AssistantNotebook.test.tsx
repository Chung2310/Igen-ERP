// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistantNotebook } from "./AssistantNotebook";
import { assistantAgentService } from "../../services/assistantAgentService";

vi.mock("../../services/assistantAgentService", () => ({
  assistantAgentService: { extractFile: vi.fn(), chat: vi.fn() },
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
async function addTextSource() {
  fireEvent.click(screen.getByRole("button", { name: /Phân tích dữ liệu/ }));
  fireEvent.click(screen.getByRole("button", { name: "Thêm tài liệu" }));
  fireEvent.click(screen.getByRole("button", { name: "Nhập văn bản" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Nội dung tài liệu" }), { target: { value: "Doanh thu quý I là 100 triệu đồng." } });
  fireEvent.click(screen.getByRole("button", { name: "Thêm nguồn" }));
  await waitFor(() => expect(screen.getByText("1 nguồn")).toBeTruthy());
}
describe("AssistantNotebook", () => {
  it("gửi nguồn đã chọn để AI trả lời bằng văn bản và không tạo sản phẩm mặc định", async () => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("source-1") });
    vi.mocked(assistantAgentService.chat).mockResolvedValue({ reply: "Doanh thu quý I là 100 triệu đồng." });
    render(<AssistantNotebook />);
    await addTextSource();
    fireEvent.change(screen.getByRole("textbox", { name: "Câu hỏi cho Notebook" }), { target: { value: "Doanh thu là bao nhiêu?" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));
    await waitFor(() => expect(screen.getByText("Doanh thu quý I là 100 triệu đồng.", { selector: "div" })).toBeTruthy());
    expect(assistantAgentService.chat).toHaveBeenCalledTimes(1);
    expect(vi.mocked(assistantAgentService.chat).mock.calls[0][0].knowledge[0].content).toContain("100 triệu");
  });
  it("gọi AI thêm một lần khi chọn Mindmap", async () => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("source-1").mockReturnValueOnce("output-1") });
    vi.mocked(assistantAgentService.chat)
      .mockResolvedValueOnce({ reply: "Doanh thu là 100 triệu đồng." })
      .mockResolvedValueOnce({ reply: '{"title":"Doanh thu","points":[{"heading":"Quý I","detail":"100 triệu đồng"}]}' });
    render(<AssistantNotebook />);
    await addTextSource();
    fireEvent.click(screen.getByRole("button", { name: "Mindmap" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Câu hỏi cho Notebook" }), { target: { value: "Tóm tắt" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));
    await waitFor(() => expect(screen.getByText("Quý I")).toBeTruthy());
    expect(assistantAgentService.chat).toHaveBeenCalledTimes(2);
  });
  it("hiển thị sổ trong danh sách và mở lại nguồn đã thêm", async () => {
    let sequence = 0;
    vi.stubGlobal("crypto", { randomUUID: () => "notebook-" + ++sequence });
    render(<AssistantNotebook />);
    await addTextSource();
    fireEvent.click(screen.getByRole("button", { name: "Quay lại danh sách Notebook" }));
    expect(screen.getByRole("button", { name: "Mở sổ Sổ dữ liệu mới" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mở sổ Sổ dữ liệu mới" }));
    expect(screen.getByText("1 nguồn")).toBeTruthy();
  });});
