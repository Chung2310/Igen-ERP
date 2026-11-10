// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistantStudioImage } from "./AssistantStudioImage";
import { requestEnhancedStudioImagePrompt, requestStudioImages } from "./assistantStudioImageApi";

vi.mock("./assistantStudioImageApi", async importOriginal => ({
  ...(await importOriginal<typeof import("./assistantStudioImageApi")>()),
  requestStudioImages: vi.fn(),
  requestEnhancedStudioImagePrompt: vi.fn(),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("AssistantStudioImage", () => {
  it("sends ratio, count and prompt to the backend and shows the branded model", async () => {
    vi.mocked(requestStudioImages).mockResolvedValue({ images: [{ url: "data:image/png;base64,YQ==" }], model: "iGenAI", aspectRatio: "16:9" });
    render(<AssistantStudioImage onBack={() => {}} />);
    expect(screen.getByText("iGenAI")).toBeTruthy();
    expect(screen.getByLabelText("Mô hình iGenAI").querySelector("img")?.getAttribute("src")).toBe("/igenai.png");
    expect(screen.queryByRole("button", { name: "Mô hình" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tỷ lệ khung hình" }));
    fireEvent.click(screen.getByRole("option", { name: "16:9 · Ngang rộng" }));
    fireEvent.click(screen.getByRole("button", { name: "Số lượng hình ảnh" }));
    fireEvent.click(screen.getByRole("option", { name: "2 ảnh" }));
    fireEvent.change(screen.getByLabelText("Mô tả hình ảnh"), { target: { value: "Một khu vườn dưới nắng sớm" } });
    fireEvent.submit(screen.getByRole("form", { name: "Thiết lập tạo hình ảnh" }));
    await waitFor(() => expect(requestStudioImages).toHaveBeenCalledWith({ prompt: "Một khu vườn dưới nắng sớm", aspectRatio: "16:9", count: 2 }));
    expect(screen.getByText("1 ảnh · iGenAI · 16:9")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Ảnh AI đã tạo 1" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tải ảnh" })).toBeTruthy();
  });

  it("shows a backend error beside the generate action", async () => {
    vi.mocked(requestStudioImages).mockRejectedValue(new Error("OpenRouter đang giới hạn yêu cầu."));
    render(<AssistantStudioImage onBack={() => {}} />);
    fireEvent.change(screen.getByLabelText("Mô tả hình ảnh"), { target: { value: "Một bông hoa màu vàng" } });
    fireEvent.submit(screen.getByRole("form", { name: "Thiết lập tạo hình ảnh" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "OpenRouter đang giới hạn yêu cầu.");
  });

  it("shows guidance and the illustration before generation", () => {
    render(<AssistantStudioImage onBack={() => {}} />);
    expect(screen.getByRole("img", { name: "Minh họa ý tưởng hình ảnh từ nhiều nguồn" }).getAttribute("src")).toBe("/ai-studio-image-empty.webp");
    expect(screen.getByText(/Nhập mô tả bên trái/)).toBeTruthy();
  });

  it("shows the shape and orientation of aspect ratios in the menu and selected value", () => {
    render(<AssistantStudioImage onBack={() => {}} />);
    const trigger = screen.getByRole("button", { name: "Tỷ lệ khung hình" });
    fireEvent.click(trigger);
    const portrait = screen.getByRole("option", { name: "9:16 · Dọc rộng" });
    const frame = portrait.querySelector("svg rect");
    expect(frame).toBeTruthy();
    expect(Number(frame?.getAttribute("height"))).toBeGreaterThan(Number(frame?.getAttribute("width")));
    fireEvent.click(portrait);
    expect(trigger.textContent).toContain("9:16 · Dọc rộng");
    expect(trigger.querySelector("svg rect")).toBeTruthy();
  });

  it("replaces a short description only after clicking the wand and can restore the original", async () => {
    vi.mocked(requestEnhancedStudioImagePrompt).mockResolvedValue("Quán cà phê buổi sáng với ánh sáng tự nhiên dịu nhẹ.");
    render(<AssistantStudioImage onBack={() => {}} />);
    const prompt = screen.getByLabelText("Mô tả hình ảnh") as HTMLTextAreaElement;
    fireEvent.change(prompt, { target: { value: "Quán cà phê buổi sáng" } });
    fireEvent.click(screen.getByRole("button", { name: "Chuẩn hóa mô tả hình ảnh" }));
    expect(requestEnhancedStudioImagePrompt).toHaveBeenCalledWith("Quán cà phê buổi sáng");
    await waitFor(() => expect(prompt.value).toBe("Quán cà phê buổi sáng với ánh sáng tự nhiên dịu nhẹ."));
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục mô tả gốc" }));
    expect(prompt.value).toBe("Quán cà phê buổi sáng");
  });

  it("keeps user edits made while prompt enhancement is pending", async () => {
    let resolveRequest!: (value: string) => void;
    vi.mocked(requestEnhancedStudioImagePrompt).mockReturnValue(new Promise(resolve => { resolveRequest = resolve; }));
    render(<AssistantStudioImage onBack={() => {}} />);
    const prompt = screen.getByLabelText("Mô tả hình ảnh") as HTMLTextAreaElement;
    fireEvent.change(prompt, { target: { value: "Quán cà phê" } });
    fireEvent.click(screen.getByRole("button", { name: "Chuẩn hóa mô tả hình ảnh" }));
    fireEvent.change(prompt, { target: { value: "Một chú mèo" } });
    resolveRequest("Quán cà phê trong ánh nắng");
    await waitFor(() => expect(screen.queryByText("Đang chuẩn hóa mô tả…")).toBeNull());
    expect(prompt.value).toBe("Một chú mèo");
  });
});
