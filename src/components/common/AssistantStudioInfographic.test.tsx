// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistantStudioInfographic } from "./AssistantStudioInfographic";
import { requestEnhancedStudioImagePrompt, requestStudioImages } from "./assistantStudioImageApi";

vi.mock("./assistantStudioImageApi", async importOriginal => ({
  ...(await importOriginal<typeof import("./assistantStudioImageApi")>()),
  requestStudioImages: vi.fn(),
  requestEnhancedStudioImagePrompt: vi.fn(),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("AssistantStudioInfographic", () => {
  it("uses the selected layout and ratio to generate an infographic", async () => {
    vi.mocked(requestStudioImages).mockResolvedValue({ images: [{ url: "data:image/png;base64,YQ==" }], model: "iGenAI", aspectRatio: "9:16" });
    render(<AssistantStudioInfographic onBack={() => {}} />);
    expect(screen.getByText("Nhập nội dung hoặc số liệu, chọn bố cục rồi tạo infographic.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Bố cục" }));
    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
    expect(screen.getByRole("button", { name: "Bố cục" }).textContent).toContain("Timeline");
    fireEvent.click(screen.getByRole("button", { name: "Tỷ lệ infographic" }));
    fireEvent.click(screen.getByRole("option", { name: "9:16 · Dọc dài" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Nội dung cần thể hiện/ }), { target: { value: "Quy trình gồm 3 bước: tiếp nhận, xử lý, hoàn tất" } });
    fireEvent.submit(screen.getByRole("form", { name: "Thiết lập tạo infographic" }));
    await waitFor(() => expect(requestStudioImages).toHaveBeenCalledWith(expect.objectContaining({ aspectRatio: "9:16", count: 1, prompt: expect.stringContaining("Bố cục: Timeline") })));
    expect(screen.getByRole("img", { name: /Infographic AI đã tạo/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tải ảnh" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Lịch sử" }));
    expect(screen.getByText("Lịch sử trong phiên này")).toBeTruthy();
  });

  it("normalizes the content and shows generation errors", async () => {
    vi.mocked(requestEnhancedStudioImagePrompt).mockResolvedValue("Quy trình bán hàng gồm ba giai đoạn rõ ràng.");
    vi.mocked(requestStudioImages).mockRejectedValue(new Error("Không thể tạo ảnh lúc này."));
    render(<AssistantStudioInfographic onBack={() => {}} />);
    const prompt = screen.getByRole("textbox", { name: /Nội dung cần thể hiện/ }) as HTMLTextAreaElement;
    fireEvent.change(prompt, { target: { value: "Quy trình bán hàng" } });
    fireEvent.click(screen.getByRole("button", { name: "Chuẩn hóa nội dung infographic" }));
    await waitFor(() => expect(prompt.value).toBe("Quy trình bán hàng gồm ba giai đoạn rõ ràng."));
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục nội dung gốc" }));
    expect(prompt.value).toBe("Quy trình bán hàng");
    fireEvent.submit(screen.getByRole("form", { name: "Thiết lập tạo infographic" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Không thể tạo ảnh lúc này.");
  });
});
