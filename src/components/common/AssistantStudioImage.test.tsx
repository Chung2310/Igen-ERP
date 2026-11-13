// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistantStudioImage } from "./AssistantStudioImage";
import { requestStudioImages } from "./assistantStudioImageApi";

vi.mock("./assistantStudioImageApi", async importOriginal => ({
  ...(await importOriginal<typeof import("./assistantStudioImageApi")>()),
  requestStudioImages: vi.fn(),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("AssistantStudioImage", () => {
  it("sends ratio, count and prompt to the backend and shows the branded model", async () => {
    vi.mocked(requestStudioImages).mockResolvedValue({ images: [{ url: "data:image/png;base64,YQ==" }], model: "iGenAI", aspectRatio: "16:9" });
    render(<AssistantStudioImage onBack={() => {}} />);
    expect(screen.getByText("iGenAI")).toBeTruthy();
    expect(screen.getByLabelText("Mô hình iGenAI").querySelector("img")?.getAttribute("src")).toBe("/igenai.png");
    expect(screen.queryByRole("button", { name: "Mô hình" })).toBeNull();
    expect(screen.queryByRole("button", { name: /chuẩn hóa/i })).toBeNull();
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
    vi.mocked(requestStudioImages).mockRejectedValue(new Error("Có sự cố từ hệ thống, vui lòng tải lại sau!"));
    render(<AssistantStudioImage onBack={() => {}} />);
    fireEvent.change(screen.getByLabelText("Mô tả hình ảnh"), { target: { value: "Một bông hoa màu vàng" } });
    fireEvent.submit(screen.getByRole("form", { name: "Thiết lập tạo hình ảnh" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Có sự cố từ hệ thống, vui lòng tải lại sau!");
  });

  it("shows guidance and the illustration before generation", () => {
    render(<AssistantStudioImage onBack={() => {}} />);
    expect(screen.getByRole("img", { name: "Minh họa bãi biển, bình hoa và đồ uống được tạo bằng AI" }).getAttribute("src")).toBe("/ai-studio-image-hero.png");
    expect(screen.getByText("Mô tả ý tưởng và chọn khung hình để bắt đầu.")).toBeTruthy();
    expect(screen.queryByText("Gợi ý phong cách")).toBeNull();
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

  it("shows sample style library with 8 styles and applies prompt and ratio on selection", () => {
    render(<AssistantStudioImage onBack={() => {}} />);
    expect(screen.getByRole("heading", { name: "Thư viện mẫu" })).toBeTruthy();
    const styleLabels = ["Poster", "Điện ảnh", "Quảng cáo", "Cổ trang", "Anime", "Ảnh thẻ", "Hoạt hình", "Banner"];
    for (const label of styleLabels) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeTruthy();
    }
    const posterButton = screen.getByRole("button", { name: /Poster/ });
    fireEvent.click(posterButton);
    const textarea = screen.getByLabelText("Mô tả hình ảnh") as HTMLTextAreaElement;
    expect(textarea.value).toContain("phong cách Poster");
    const ratioTrigger = screen.getByRole("button", { name: "Tỷ lệ khung hình" });
    expect(ratioTrigger.textContent).toContain("1:1 · Vuông");
  });
});
