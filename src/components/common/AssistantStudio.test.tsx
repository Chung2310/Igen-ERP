// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AssistantStudio } from "./AssistantStudio";

afterEach(cleanup);

describe("AssistantStudio", () => {
  it("opens the infographic workspace from the image tools", () => {
    render(<AssistantStudio />);
    fireEvent.click(screen.getByRole("button", { name: /Tạo infographic/ }));
    expect(screen.getByRole("form", { name: "Thiết lập tạo infographic" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Minh họa infographic với quy trình/ })).toBeTruthy();
  });

  it("filters tools and keeps every upcoming tool locked", () => {
    render(<AssistantStudio />);
    const studioTitle = screen.getByRole("heading", { name: "Chào mừng đến với iGen AI Studio" });
    expect(studioTitle.parentElement?.className).toContain("text-left");
    expect(studioTitle.className).toContain("text-[clamp(1rem,2.8vw,2.5rem)]!");
    expect(studioTitle.className).toContain("whitespace-nowrap!");
    expect(studioTitle.querySelector("svg")).not.toBeNull();
    expect(screen.queryByText("Khám phá iGen AI Studio")).toBeNull();
    expect(screen.getByRole("button", { name: /Tóm tắt YouTube/ }).querySelector("span[aria-hidden]")?.getAttribute("style")).toContain("ai-studio-content-tools.webp");
    expect(screen.getByRole("button", { name: /Tạo slide/ }).querySelector('img[src="/assistant-studio/slide-color.webp"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: /Tạo Mindmap/ }).querySelector('img[src="/assistant-studio/mindmap-color.webp"]')).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Soạn nội dung/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Video$/ }));
    const videoTool = screen.getByRole("button", { name: /Tạo video/ });
    const youtubeTool = screen.getByRole("button", { name: /Tóm tắt YouTube/ });
    expect(videoTool).toHaveProperty("disabled", true);
    expect(youtubeTool).toHaveProperty("disabled", true);
    expect(within(videoTool).getAllByText("Sắp ra mắt").length).toBeGreaterThan(0);
    expect(within(youtubeTool).getAllByText("Sắp ra mắt").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Tạo hình ảnh/ })).toBeNull();

    fireEvent.click(videoTool);
    expect(screen.getByRole("heading", { name: "Chào mừng đến với iGen AI Studio" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Ý tưởng video" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tất cả" }));
    fireEvent.click(screen.getByRole("button", { name: /Tạo slide/ }));
    expect(screen.getByRole("heading", { name: "Tạo slide" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Chủ đề và nội dung" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "AI Studio" }));
    fireEvent.click(screen.getByRole("button", { name: /Tạo Mindmap/ }));
    expect(screen.getByRole("heading", { name: "Tạo mindmap" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Chủ đề và nội dung tạo mindmap" })).toBeTruthy();
  });
});
