// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistantStudioInfographic } from "./AssistantStudioInfographic";
import { requestStudioImages } from "./assistantStudioImageApi";

vi.mock("./assistantStudioImageApi", async importOriginal => ({
  ...(await importOriginal<typeof import("./assistantStudioImageApi")>()),
  requestStudioImages: vi.fn(),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("AssistantStudioInfographic", () => {
  it("uses the selected layout and ratio to generate an infographic", async () => {
    vi.mocked(requestStudioImages).mockResolvedValue({ images: [{ url: "data:image/png;base64,YQ==" }], model: "iGenAI", aspectRatio: "9:16" });
    render(<AssistantStudioInfographic onBack={() => {}} />);
    expect(screen.getByRole("form", { name: "Thiết lập tạo infographic" })).toBeTruthy();
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
    expect(screen.getByRole("dialog", { name: "Lịch sử infographic" })).toBeTruthy();
  });

  it("shows infographic generation errors", async () => {
    vi.mocked(requestStudioImages).mockRejectedValue(new Error("Không thể tạo ảnh lúc này."));
    render(<AssistantStudioInfographic onBack={() => {}} />);
    const prompt = screen.getByRole("textbox", { name: /Nội dung cần thể hiện/ }) as HTMLTextAreaElement;
    fireEvent.change(prompt, { target: { value: "Quy trình bán hàng" } });
    fireEvent.submit(screen.getByRole("form", { name: "Thiết lập tạo infographic" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Không thể tạo ảnh lúc này.");
  });

  it("renders all layouts in the layout menu including the 4th item in each group", () => {
    render(<AssistantStudioInfographic onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Bố cục" }));
    expect(screen.getByRole("dialog", { name: "Danh sách bố cục infographic" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Timeline" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gantt" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Vòng tròn" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Trình tự" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Venn" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Vòng lặp" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sơ đồ cây" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Trình tự" }));
    expect(screen.getByRole("button", { name: "Bố cục" }).textContent).toContain("Trình tự");
  });
});
